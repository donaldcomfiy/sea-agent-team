"""Unit-Tests fuer den Campaign Builder (google_ads_client).

Laufen vollstaendig offline ohne Google-Cloud- oder Google-Ads-Credentials.
Der Kern dieser Tests ist, dass die drei Sicherheitsregeln (PAUSED, 1 Euro/Tag,
nur SEARCH) IMMER erzwungen werden - auch wenn der eingehende Plan etwas
anderes verlangt.
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from app.google_ads_client import (  # noqa: E402
    CHANNEL_TYPE,
    DAILY_BUDGET_MICROS,
    FORCED_STATUS,
    build_search_campaigns,
    list_accounts,
    normalize_plan,
)

_ADS_ENV = (
    "GOOGLE_ADS_DEVELOPER_TOKEN",
    "GOOGLE_ADS_CLIENT_ID",
    "GOOGLE_ADS_CLIENT_SECRET",
    "GOOGLE_ADS_REFRESH_TOKEN",
    "GOOGLE_ADS_LOGIN_CUSTOMER_ID",
    "GOOGLE_ADS_CUSTOMER_ID",
)


@pytest.fixture(autouse=True)
def _isolate_settings(monkeypatch, tmp_path):
    """Guarantee mock mode: point the settings store at an empty temp file and
    clear any real Google Ads env so a developer's local creds can't flip these
    offline tests into live mode."""
    monkeypatch.setattr("app.google_ads_settings._FILE", str(tmp_path / "settings.json"))
    for env in _ADS_ENV:
        monkeypatch.delenv(env, raising=False)

# Ein Plan, der absichtlich gegen die Regeln "verstoesst": fremder Kampagnentyp
# (Display/PMax) und grosse Budgets. Der Builder muss das ignorieren.
SAMPLE = {
    "domain": "test.de",
    "kampagnen": [
        {"name": "Brand Search", "typ": "Suchnetzwerk", "budget": "500 Euro/Tag"},
        {"name": "Display Remarketing", "typ": "Display", "budget": "999 Euro/Tag"},
    ],
    "keywords": [
        {"kampagne": "Brand Search", "anzeigengruppe": "Brand", "keyword": "[test marke]", "match_type": "Exact"},
        {"kampagne": "Brand Search", "anzeigengruppe": "Brand", "keyword": '"test shop"'},
        # duplicate of the first keyword -> must be deduped away
        {"kampagne": "Brand Search", "anzeigengruppe": "Brand", "keyword": "[test marke]", "match_type": "Exact"},
        {"kampagne": "Brand Search", "anzeigengruppe": "Generisch", "keyword": "guenstig kaufen"},
    ],
    "anzeigentexte": [
        {
            "kampagne": "Brand Search",
            "anzeigengruppe": "Brand",
            # 3 headlines (one intentionally > 30 chars to trigger a warning) + 2 descriptions
            "headlines": [
                "Offizieller Test Shop",
                "Marke guenstig kaufen",
                "Diese Headline ist viel zu lang fuer Google Ads",
            ],
            "descriptions": ["Kurze Beschreibung.", "Zweite Beschreibung fuer die RSA."],
        },
    ],
}


def _result():
    return build_search_campaigns(SAMPLE)


def test_mode_is_mock_without_credentials(monkeypatch):
    monkeypatch.delenv("GOOGLE_ADS_DEVELOPER_TOKEN", raising=False)
    monkeypatch.delenv("GOOGLE_ADS_CUSTOMER_ID", raising=False)
    result = _result()
    assert result["mode"] == "mock"
    assert result["dry_run"] is True


def test_safety_rules_block_is_fixed():
    rules = _result()["rules"]
    assert rules["status"] == FORCED_STATUS == "PAUSED"
    assert rules["channel"] == CHANNEL_TYPE == "SEARCH"
    assert rules["daily_budget_micros"] == DAILY_BUDGET_MICROS == 1_000_000
    assert rules["daily_budget_eur"] == 1.0


def test_every_entity_is_paused_search_and_one_euro():
    result = _result()
    assert result["campaigns"], "es sollten Kampagnen angelegt werden"
    for camp in result["campaigns"]:
        assert camp["status"] == "PAUSED"
        assert camp["channel"] == "SEARCH"
        assert camp["daily_budget_eur"] == 1.0
        for ag in camp["ad_groups"]:
            assert ag["status"] == "PAUSED"
            for kw in ag["keywords"]:
                assert kw["status"] == "PAUSED"
            for ad in ag["ads"]:
                assert ad["status"] == "PAUSED"


def test_oversized_budget_and_type_in_plan_are_ignored():
    # Selbst der "Display Remarketing"-Eintrag mit 999 Euro wird als SEARCH mit
    # 1 Euro angelegt - der Plan darf die Regeln nicht aushebeln.
    result = _result()
    display = next(c for c in result["campaigns"] if c["name"] == "Display Remarketing")
    assert display["channel"] == "SEARCH"
    assert display["daily_budget_eur"] == 1.0


def test_match_type_inference():
    norm = normalize_plan(SAMPLE)
    brand = next(c for c in norm["campaigns"] if c["name"] == "Brand Search")
    brand_ag = next(ag for ag in brand["ad_groups"] if ag["name"] == "Brand")
    by_text = {kw["text"]: kw["match_type"] for kw in brand_ag["keywords"]}
    assert by_text["test marke"] == "EXACT"   # explicit + [brackets] stripped
    assert by_text["test shop"] == "PHRASE"    # inferred from "quotes"
    generic_ag = next(ag for ag in brand["ad_groups"] if ag["name"] == "Generisch")
    assert generic_ag["keywords"][0]["match_type"] == "BROAD"


def test_oversized_headline_produces_warning():
    warnings = _result()["warnings"]
    assert any("Headline ueber 30 Zeichen" in w for w in warnings)


def test_rsa_uses_domain_as_final_url():
    norm = normalize_plan(SAMPLE)
    brand = next(c for c in norm["campaigns"] if c["name"] == "Brand Search")
    brand_ag = next(ag for ag in brand["ad_groups"] if ag["name"] == "Brand")
    assert brand_ag["ads"], "Brand ad group should have an RSA"
    assert brand_ag["ads"][0]["final_url"] == "https://test.de"


def test_rsa_skipped_without_final_url():
    plan = {
        # no top-level domain and no per-ad url -> RSA cannot be built
        "kampagnen": [{"name": "C"}],
        "anzeigentexte": [
            {"kampagne": "C", "anzeigengruppe": "AG", "headlines": ["a", "b", "c"], "descriptions": ["d1", "d2"]},
        ],
    }
    norm = normalize_plan(plan)
    ag = norm["campaigns"][0]["ad_groups"][0]
    assert ag["ads"] == []
    assert any("Final-URL" in w for w in norm["warnings"])


def test_keywords_are_deduped():
    # SAMPLE has "[test marke]" Exact twice in the Brand ad group -> one survives.
    norm = normalize_plan(SAMPLE)
    brand = next(c for c in norm["campaigns"] if c["name"] == "Brand Search")
    brand_ag = next(ag for ag in brand["ad_groups"] if ag["name"] == "Brand")
    exact_marke = [k for k in brand_ag["keywords"] if k["text"] == "test marke" and k["match_type"] == "EXACT"]
    assert len(exact_marke) == 1


def test_counts_match():
    created = _result()["created"]
    assert created["campaigns"] == 2
    assert created["budgets"] == 2
    assert created["ad_groups"] == 2   # Brand + Generisch (nur unter Brand Search)
    assert created["keywords"] == 3
    assert created["ads"] == 1


def test_customer_id_override_is_used(monkeypatch):
    monkeypatch.delenv("GOOGLE_ADS_DEVELOPER_TOKEN", raising=False)
    monkeypatch.delenv("GOOGLE_ADS_CUSTOMER_ID", raising=False)
    result = build_search_campaigns(SAMPLE, "999-888-7777")
    assert result["customer_id"] == "999-888-7777"
    assert "999-888-7777" in result["campaigns"][0]["resource_name"]


def test_list_accounts_mock_without_credentials(monkeypatch):
    monkeypatch.delenv("GOOGLE_ADS_DEVELOPER_TOKEN", raising=False)
    accounts = list_accounts()
    assert len(accounts) >= 1
    assert all("id" in a and "name" in a for a in accounts)


def test_copywriter_positions_format():
    """The copywriter outputs ads with nested positions[].headlines and uses
    'ads' instead of 'anzeigentexte'. normalize_plan must flatten these into
    RSAs and match ad groups to existing campaigns from the keywords section."""
    plan = {
        "domain": "example.de",
        "kampagnen": [{"name": "Brand Search"}],
        "keywords": [
            {"kampagne": "Brand Search", "anzeigengruppe": "Brand Core", "keyword": "[example]", "match_type": "Exact"},
        ],
        "ads": {
            "type": "ads",
            "ad_groups": [
                {
                    "name": "Brand Core",
                    "url": "www.example.de",
                    "positions": [
                        {"label": "Produkt / Keyword", "headlines": ["Example Shop", "Example Online"]},
                        {"label": "USP / Nutzen", "headlines": ["Gratis Versand"]},
                        {"label": "Call-to-Action", "headlines": ["Jetzt kaufen"]},
                    ],
                    "descriptions": ["Entdecke Example jetzt.", "Kostenloser Versand ab 50 EUR."],
                },
            ],
        },
    }
    norm = normalize_plan(plan)
    brand = next(c for c in norm["campaigns"] if c["name"] == "Brand Search")
    ag = next(ag for ag in brand["ad_groups"] if ag["name"] == "Brand Core")
    assert len(ag["ads"]) == 1, "RSA should be created from positions format"
    rsa = ag["ads"][0]
    assert rsa["headlines"] == ["Example Shop", "Example Online", "Gratis Versand", "Jetzt kaufen"]
    assert rsa["descriptions"] == ["Entdecke Example jetzt.", "Kostenloser Versand ab 50 EUR."]
    assert rsa["final_url"] == "https://www.example.de"


def test_copywriter_format_without_kampagne_field():
    """When the copywriter format has no 'kampagne' field, the ad group should
    be matched to the campaign that already contains it (from keywords)."""
    plan = {
        "domain": "shop.de",
        "kampagnen": [{"name": "Generic"}, {"name": "Brand"}],
        "keywords": [
            {"kampagne": "Generic", "anzeigengruppe": "Allgemein", "keyword": "kaufen"},
            {"kampagne": "Brand", "anzeigengruppe": "Marke", "keyword": "[shop]"},
        ],
        "ads": {
            "type": "ads",
            "ad_groups": [
                {
                    "name": "Marke",
                    "positions": [
                        {"label": "P1", "headlines": ["H1", "H2", "H3"]},
                    ],
                    "descriptions": ["D1", "D2"],
                },
            ],
        },
    }
    norm = normalize_plan(plan)
    brand = next(c for c in norm["campaigns"] if c["name"] == "Brand")
    ag = next(ag for ag in brand["ad_groups"] if ag["name"] == "Marke")
    assert len(ag["ads"]) == 1, "RSA should land in Brand campaign via ad group name lookup"


def test_plan_without_ads_returns_error():
    """When keywords exist but the entire anzeigentexte/ads section is missing,
    build_search_campaigns must refuse with a clear error instead of creating
    ad groups that can never serve."""
    plan_no_ads = {
        "domain": "test.de",
        "kampagnen": [{"name": "Brand"}],
        "keywords": [
            {"kampagne": "Brand", "anzeigengruppe": "Core", "keyword": "[test]", "match_type": "Exact"},
        ],
        # no anzeigentexte / ads section at all
    }
    result = build_search_campaigns(plan_no_ads)
    assert result["mode"] == "error"
    assert "KEINE Anzeigen" in result["error"]
    assert result["created"]["ads"] == 0


def test_credentials_gating(monkeypatch):
    from app.google_ads_client import REQUIRED_ENV, credentials_present

    # All required vars present -> live mode is selected.
    for key in REQUIRED_ENV:
        monkeypatch.setenv(key, "dummy")
    assert credentials_present() is True

    # Removing any single required var falls back to mock.
    monkeypatch.delenv(REQUIRED_ENV[0], raising=False)
    assert credentials_present() is False
