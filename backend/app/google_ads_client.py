# Builds Google Ads SEARCH campaigns from the semantic campaign JSON
# (the same shape the excel_exporter_agent consumes: kampagnen / keywords /
# anzeigentexte).
#
# HARD SAFETY RULES — enforced here in code, not just in the agent prompt, so a
# misbehaving model can never override them:
#   - every entity (campaign, ad group, keyword, ad) is created PAUSED
#   - each campaign gets a FIXED daily budget of 1 EUR
#   - only SEARCH campaigns are created
# These are module constants and are re-applied during normalization regardless
# of what the incoming plan requests.
#
# Two backends, chosen at call time by the presence of Google Ads credentials
# (mirrors the MongoDB/JSON pattern in agent.py):
#   - creds set  -> real google-ads API mutate (next phase; see _real_create)
#   - unset      -> mock that simulates creation and returns fake resource names

import os
from typing import Any

from app.google_ads_settings import get_config

DAILY_BUDGET_MICROS = 1_000_000  # 1 EUR/day in micros — fixed, never overridden
FORCED_STATUS = "PAUSED"         # every entity paused — fixed
CHANNEL_TYPE = "SEARCH"          # search campaigns only

# Credentials needed to build a real google-ads client. All present -> live mode,
# otherwise mock. GOOGLE_ADS_LOGIN_CUSTOMER_ID (manager) and GOOGLE_ADS_CUSTOMER_ID
# (default target) are optional: login-customer-id is needed for manager access /
# account listing, the target account is normally chosen per request.
REQUIRED_ENV = (
    "GOOGLE_ADS_DEVELOPER_TOKEN",
    "GOOGLE_ADS_CLIENT_ID",
    "GOOGLE_ADS_CLIENT_SECRET",
    "GOOGLE_ADS_REFRESH_TOKEN",
)

# Demo accounts shown by the picker in mock mode (no real credentials). Each is
# {id, name}; ids use the human 10-digit dashed form.
MOCK_ACCOUNTS: list[dict[str, str]] = [
    {"id": "123-456-7890", "name": "Acme Marketing GmbH"},
    {"id": "234-567-8901", "name": "ESN Webshop"},
    {"id": "345-678-9012", "name": "DAK Gesundheit"},
]


# Logical config keys that must be present (via settings file or .env) to build
# a live client. Mirrors REQUIRED_ENV but resolved through the settings store.
_REQUIRED_CONFIG = ("developer_token", "client_id", "client_secret", "refresh_token")


def credentials_present(user_id: str | None = None) -> bool:
    """True only if the minimum Google Ads credentials are configured (settings
    file or .env)."""
    cfg = get_config(user_id)
    return all(cfg.get(k) for k in _REQUIRED_CONFIG)


def _format_cid(cid: str) -> str:
    """Format a 10-digit customer id as xxx-xxx-xxxx for display."""
    digits = "".join(ch for ch in str(cid) if ch.isdigit())
    if len(digits) == 10:
        return f"{digits[0:3]}-{digits[3:6]}-{digits[6:10]}"
    return str(cid)


def list_accounts(user_id: str | None = None) -> list[dict[str, str]]:
    """Accessible Google Ads client accounts (id + name) for the picker.

    Mock mode (no credentials) returns demo accounts so the dropdown is usable
    immediately. Live mode lists the manager's enabled client accounts.
    """
    if not credentials_present(user_id):
        return [dict(a) for a in MOCK_ACCOUNTS]
    try:
        return _live_list_accounts(user_id)
    except Exception:
        # Never break the picker on a listing failure — caller can still type/use
        # a default account; the agent surfaces the empty list.
        return []


def _live_list_accounts(user_id: str | None = None) -> list[dict[str, str]]:
    """Live account listing. Under a manager (login-customer-id) we query the
    enabled, non-manager client accounts; otherwise the directly accessible ones.
    """
    client = _build_client(user_id)
    login_cid = get_config(user_id).get("login_customer_id", "").replace("-", "").strip()
    ga_service = client.get_service("GoogleAdsService")

    if login_cid:
        query = (
            "SELECT customer_client.id, customer_client.descriptive_name, "
            "customer_client.manager FROM customer_client "
            "WHERE customer_client.status = 'ENABLED'"
        )
        out: list[dict[str, str]] = []
        for row in ga_service.search(customer_id=login_cid, query=query):
            cc = row.customer_client
            if cc.manager:
                continue  # only leaf client accounts get campaigns
            cid = str(cc.id)
            out.append({"id": _format_cid(cid), "name": cc.descriptive_name or cid})
        return out

    customer_service = client.get_service("CustomerService")
    accessible = customer_service.list_accessible_customers()
    out = []
    for resource_name in accessible.resource_names:
        cid = resource_name.split("/")[-1]
        out.append({"id": _format_cid(cid), "name": cid})
    return out


def _bid_strategy_kind(text: str) -> str:
    """Map a free-text bid strategy from the strategy/plan to a canonical kind
    that we know how to apply via the google-ads API.

    Supports the three strategies the strategy_agent actually emits today:
      - MAXIMIZE_CONVERSIONS  ("Conversions maximieren", "Maximize Conversions")
      - MAXIMIZE_CLICKS       ("Klicks maximieren", "Maximize Clicks") - mapped
        to TargetSpend on the API side
      - MANUAL_CPC            ("Manuelles CPC", "Manual CPC") - default fallback
        when we cannot identify the requested strategy
    """
    t = (text or "").lower()
    if "manuell" in t or "manual" in t:
        return "MANUAL_CPC"
    if "conv" in t:
        return "MAXIMIZE_CONVERSIONS"
    if "klick" in t or "click" in t:
        return "MAXIMIZE_CLICKS"
    return "MANUAL_CPC"


def _match_type(keyword: str, explicit: str | None) -> tuple[str, str]:
    """Return (clean_text, match_type) for a keyword token.

    Prefers an explicit match_type field; otherwise infers from decoration:
    [brackets] -> EXACT, "quotes" -> PHRASE, plain -> BROAD. The brackets/quotes
    are stripped from the keyword text either way.
    """
    text = (keyword or "").strip()
    mt = (explicit or "").strip().upper()

    def strip_decoration(s: str) -> str:
        if len(s) >= 2 and s[0] == "[" and s[-1] == "]":
            return s[1:-1].strip()
        if len(s) >= 2 and s[0] == '"' and s[-1] == '"':
            return s[1:-1].strip()
        return s

    if mt in ("EXACT", "PHRASE", "BROAD"):
        return strip_decoration(text), mt
    if text.startswith("[") and text.endswith("]"):
        return strip_decoration(text), "EXACT"
    if text.startswith('"') and text.endswith('"'):
        return strip_decoration(text), "PHRASE"
    return text, "BROAD"


def _resolve_customer_id(customer_id: str | None, user_id: str | None = None) -> str:
    """Target account: explicit per-request id wins, else the configured default,
    else the MOCK marker. Dashes are kept for display (the real API path would
    strip them)."""
    cid = (customer_id or "").strip() or get_config(user_id).get("customer_id", "").strip()
    return cid or "MOCK"


def normalize_plan(
    plan: dict[str, Any],
    customer_id: str | None = None,
    user_id: str | None = None,
) -> dict[str, Any]:
    """Turn the semantic campaign JSON into a flat, rule-enforced build plan
    grouped campaign -> ad group -> {keywords, ads}.

    The three safety rules (PAUSED / 1 EUR / SEARCH) are applied here so every
    downstream backend inherits them. Any budget or campaign type in the input
    is intentionally ignored. customer_id is the chosen target account.
    """
    if not isinstance(plan, dict):
        raise ValueError("campaign_data muss ein JSON-Objekt sein")

    warnings: list[str] = []
    campaigns: dict[str, dict[str, Any]] = {}

    # Final URL for the ads: prefer a per-ad-group url, else the plan's domain.
    domain = str(plan.get("domain", "")).strip()
    default_url = ""
    if domain:
        default_url = domain if domain.lower().startswith(("http://", "https://")) else "https://" + domain

    def ensure_campaign(name: str, source: dict[str, Any] | None = None) -> dict[str, Any]:
        key = name or "Unbenannte Kampagne"
        if key not in campaigns:
            campaigns[key] = {
                "name": key,
                "status": FORCED_STATUS,
                "channel": CHANNEL_TYPE,
                "daily_budget_micros": DAILY_BUDGET_MICROS,
                "daily_budget_eur": DAILY_BUDGET_MICROS / 1_000_000,
                # Free-text bid strategy from the strategy/excel plan. Builder
                # converts this to the canonical kind at mutate time. Defaults
                # to Manual CPC when nothing is specified.
                "bid_strategy_raw": "",
                "bid_strategy_kind": "MANUAL_CPC",
                "ad_groups": {},
            }
        if source:
            # Accept both English ("bid_strategy" from strategy_agent) and
            # German ("gebotsstrategie" from excel_exporter_agent) field names.
            raw = str(source.get("bid_strategy") or source.get("gebotsstrategie") or "").strip()
            if raw and not campaigns[key]["bid_strategy_raw"]:
                campaigns[key]["bid_strategy_raw"] = raw
                campaigns[key]["bid_strategy_kind"] = _bid_strategy_kind(raw)
        return campaigns[key]

    def ensure_ad_group(camp: dict[str, Any], name: str) -> dict[str, Any]:
        key = name or "Standard"
        ags = camp["ad_groups"]
        if key not in ags:
            ags[key] = {"name": key, "status": FORCED_STATUS, "keywords": [], "ads": []}
        return ags[key]

    for c in plan.get("kampagnen", []) or []:
        if isinstance(c, dict):
            ensure_campaign(str(c.get("name", "")).strip(), c)

    for kw in plan.get("keywords", []) or []:
        if not isinstance(kw, dict):
            continue
        camp = ensure_campaign(str(kw.get("kampagne", "")).strip())
        ag = ensure_ad_group(camp, str(kw.get("anzeigengruppe", "")).strip())
        text, mt = _match_type(str(kw.get("keyword", "")), kw.get("match_type"))
        if text and not any(k["text"] == text and k["match_type"] == mt for k in ag["keywords"]):
            # Dedupe within an ad group: the API rejects duplicate keyword+match_type.
            ag["keywords"].append({"text": text, "match_type": mt, "status": FORCED_STATUS})

    # Collect ad entries: the excel-exporter format uses "anzeigentexte" (flat),
    # the copywriter format uses "ads" with nested {type, ad_groups: [{positions}]}.
    ad_entries: list[dict[str, Any]] = list(plan.get("anzeigentexte", []) or [])
    if not ad_entries:
        ads_block = plan.get("ads")
        if isinstance(ads_block, dict) and "ad_groups" in ads_block:
            ad_entries = list(ads_block.get("ad_groups") or [])
        elif isinstance(ads_block, list):
            ad_entries = list(ads_block)

    for ad in ad_entries:
        if not isinstance(ad, dict):
            continue
        camp_name = str(ad.get("kampagne", "")).strip()
        ag_name = str(ad.get("anzeigengruppe", "") or ad.get("name", "")).strip()

        # Copywriter format omits kampagne — find the ad group in an
        # already-created campaign (built from the keywords section).
        if not camp_name and ag_name:
            for c in campaigns.values():
                if ag_name in c["ad_groups"]:
                    camp_name = c["name"]
                    break

        camp = ensure_campaign(camp_name)
        ag = ensure_ad_group(camp, ag_name)

        # Flatten headlines: direct list (excel format) or nested
        # positions[].headlines (copywriter format).
        headlines = [str(h).strip() for h in (ad.get("headlines") or []) if str(h).strip()]
        if not headlines:
            for pos in (ad.get("positions") or []):
                if isinstance(pos, dict):
                    for h in (pos.get("headlines") or []):
                        h_str = str(h).strip()
                        if h_str:
                            headlines.append(h_str)

        descriptions = [str(d).strip() for d in (ad.get("descriptions") or []) if str(d).strip()]
        for h in headlines:
            if len(h) > 30:
                warnings.append(f"Headline ueber 30 Zeichen ({len(h)}): {h}")
        for d in descriptions:
            if len(d) > 90:
                warnings.append(f"Description ueber 90 Zeichen ({len(d)}): {d}")
        url = str(ad.get("url", "")).strip()
        final_url = url or default_url
        if final_url and not final_url.lower().startswith(("http://", "https://")):
            final_url = "https://" + final_url
        if headlines or descriptions:
            if not final_url:
                warnings.append(f"RSA in '{ag['name']}' uebersprungen: keine Final-URL (domain/url im Plan fehlt).")
            elif len(headlines) < 3 or len(descriptions) < 2:
                warnings.append(f"RSA in '{ag['name']}' uebersprungen: braucht mind. 3 Headlines und 2 Descriptions.")
            else:
                ag["ads"].append({
                    "type": "RSA",
                    "status": FORCED_STATUS,
                    "final_url": final_url,
                    "headlines": headlines,
                    "descriptions": descriptions,
                })

    campaign_list: list[dict[str, Any]] = []
    for camp in campaigns.values():
        camp_out = dict(camp)
        camp_out["ad_groups"] = list(camp["ad_groups"].values())
        campaign_list.append(camp_out)

    return {
        "customer_id": _resolve_customer_id(customer_id, user_id),
        "rules": {
            "status": FORCED_STATUS,
            "daily_budget_eur": DAILY_BUDGET_MICROS / 1_000_000,
            "daily_budget_micros": DAILY_BUDGET_MICROS,
            "channel": CHANNEL_TYPE,
        },
        "campaigns": campaign_list,
        "warnings": warnings,
    }


def _mock_create(norm: dict[str, Any]) -> dict[str, Any]:
    """Simulate the API mutations and return fake-but-realistic resource names."""
    cust = norm["customer_id"]
    counter = 0

    def rid() -> int:
        nonlocal counter
        counter += 1
        return 1000 + counter

    created = {"campaigns": 0, "budgets": 0, "ad_groups": 0, "keywords": 0, "ads": 0}
    out_campaigns: list[dict[str, Any]] = []
    for camp in norm["campaigns"]:
        budget_id, camp_id = rid(), rid()
        created["budgets"] += 1
        created["campaigns"] += 1
        ad_groups_out: list[dict[str, Any]] = []
        for ag in camp["ad_groups"]:
            ag_id = rid()
            created["ad_groups"] += 1
            created["keywords"] += len(ag["keywords"])
            created["ads"] += len(ag["ads"])
            ad_groups_out.append({
                "name": ag["name"],
                "status": ag["status"],
                "resource_name": f"customers/{cust}/adGroups/{ag_id}",
                "keywords": ag["keywords"],
                "ads": ag["ads"],
            })
        out_campaigns.append({
            "name": camp["name"],
            "status": camp["status"],
            "channel": camp["channel"],
            "daily_budget_eur": camp["daily_budget_eur"],
            "bid_strategy_raw": camp.get("bid_strategy_raw", ""),
            "bid_strategy_kind": camp.get("bid_strategy_kind", "MANUAL_CPC"),
            "budget_resource_name": f"customers/{cust}/campaignBudgets/{budget_id}",
            "resource_name": f"customers/{cust}/campaigns/{camp_id}",
            "ad_groups": ad_groups_out,
        })

    return {
        "mode": "mock",
        "dry_run": True,
        "customer_id": cust,
        "rules": norm["rules"],
        "created": created,
        "campaigns": out_campaigns,
        "warnings": norm["warnings"],
    }


def _build_client(user_id: str | None = None):
    """Build a GoogleAdsClient from environment variables (no google-ads.yaml).

    Lazy-imports the library so the module works in mock mode without google-ads
    installed. Raises ImportError if the lib is missing.
    """
    from google.ads.googleads.client import GoogleAdsClient  # lazy

    cfg = get_config(user_id)
    config: dict[str, Any] = {
        "developer_token": cfg["developer_token"],
        "client_id": cfg["client_id"],
        "client_secret": cfg["client_secret"],
        "refresh_token": cfg["refresh_token"],
        "use_proto_plus": True,
    }
    login_cid = cfg.get("login_customer_id", "").replace("-", "").strip()
    if login_cid:
        config["login_customer_id"] = login_cid
    return GoogleAdsClient.load_from_dict(config)


def _empty_counts() -> dict[str, int]:
    return {"campaigns": 0, "budgets": 0, "ad_groups": 0, "keywords": 0, "ads": 0}


def _live_error(norm: dict[str, Any], message: str) -> dict[str, Any]:
    """Graceful failure result for the live path (lib missing, auth/API error).
    Nothing is reported as created so the agent can relay the problem cleanly."""
    return {
        "mode": "live-error",
        "dry_run": True,
        "customer_id": norm["customer_id"],
        "rules": norm["rules"],
        "created": _empty_counts(),
        "campaigns": [],
        "warnings": norm["warnings"],
        "note": message,
    }


def _create_budget(client, customer_id: str, campaign_name: str) -> str:
    service = client.get_service("CampaignBudgetService")
    op = client.get_type("CampaignBudgetOperation")
    budget = op.create
    budget.name = f"{campaign_name} Budget"
    budget.amount_micros = DAILY_BUDGET_MICROS  # fixed 1 EUR/day
    budget.delivery_method = client.enums.BudgetDeliveryMethodEnum.STANDARD
    budget.explicitly_shared = False
    resp = service.mutate_campaign_budgets(customer_id=customer_id, operations=[op])
    return resp.results[0].resource_name


def _create_campaign(
    client,
    customer_id: str,
    name: str,
    budget_resource: str,
    bid_strategy_kind: str = "MANUAL_CPC",
) -> str:
    service = client.get_service("CampaignService")
    op = client.get_type("CampaignOperation")
    campaign = op.create
    campaign.name = name  # the user controls naming via the name_editor step
    campaign.advertising_channel_type = client.enums.AdvertisingChannelTypeEnum.SEARCH  # SEARCH only
    campaign.status = client.enums.CampaignStatusEnum.PAUSED  # always paused
    # Required since the EU political-advertising transparency rule: declare that
    # these campaigns do not contain EU political advertising.
    campaign.contains_eu_political_advertising = (
        client.enums.EuPoliticalAdvertisingStatusEnum.DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING
    )
    # Bid strategy: drives the auction behaviour. The strategy_agent picks the
    # free-text label, normalize_plan maps it to one of the canonical kinds.
    # Campaign.bidding_strategy is a oneof – assigning a fresh message activates
    # the chosen branch. Manual CPC is the safe default for unknown labels.
    if bid_strategy_kind == "MAXIMIZE_CONVERSIONS":
        campaign.maximize_conversions.target_cpa_micros = 0
    elif bid_strategy_kind == "MAXIMIZE_CLICKS":
        campaign.target_spend.target_spend_micros = 0
    else:  # MANUAL_CPC
        campaign.manual_cpc.enhanced_cpc_enabled = False
    campaign.campaign_budget = budget_resource
    campaign.network_settings.target_google_search = True
    campaign.network_settings.target_search_network = True
    campaign.network_settings.target_content_network = False
    campaign.network_settings.target_partner_search_network = False
    resp = service.mutate_campaigns(customer_id=customer_id, operations=[op])
    return resp.results[0].resource_name


def _create_ad_group(client, customer_id: str, campaign_resource: str, name: str) -> str:
    service = client.get_service("AdGroupService")
    op = client.get_type("AdGroupOperation")
    ad_group = op.create
    ad_group.name = name
    ad_group.campaign = campaign_resource
    ad_group.type_ = client.enums.AdGroupTypeEnum.SEARCH_STANDARD
    ad_group.status = client.enums.AdGroupStatusEnum.PAUSED  # always paused
    ad_group.cpc_bid_micros = DAILY_BUDGET_MICROS  # placeholder max CPC (1 EUR)
    resp = service.mutate_ad_groups(customer_id=customer_id, operations=[op])
    return resp.results[0].resource_name


def _create_keywords(client, customer_id: str, ad_group_resource: str, keywords: list[dict]) -> None:
    service = client.get_service("AdGroupCriterionService")
    mt_enum = client.enums.KeywordMatchTypeEnum
    mt_map = {"EXACT": mt_enum.EXACT, "PHRASE": mt_enum.PHRASE, "BROAD": mt_enum.BROAD}
    ops = []
    for kw in keywords:
        op = client.get_type("AdGroupCriterionOperation")
        crit = op.create
        crit.ad_group = ad_group_resource
        crit.status = client.enums.AdGroupCriterionStatusEnum.PAUSED  # always paused
        crit.keyword.text = kw["text"]
        crit.keyword.match_type = mt_map.get(kw.get("match_type"), mt_enum.BROAD)
        ops.append(op)
    if ops:
        service.mutate_ad_group_criteria(customer_id=customer_id, operations=ops)


def _create_rsa(client, customer_id: str, ad_group_resource: str, ad: dict) -> None:
    service = client.get_service("AdGroupAdService")
    op = client.get_type("AdGroupAdOperation")
    ad_group_ad = op.create
    ad_group_ad.ad_group = ad_group_resource
    ad_group_ad.status = client.enums.AdGroupAdStatusEnum.PAUSED  # always paused
    ad_group_ad.ad.final_urls.append(ad["final_url"])  # RSA requires a final URL
    rsa = ad_group_ad.ad.responsive_search_ad
    for headline in ad.get("headlines", [])[:15]:
        asset = client.get_type("AdTextAsset")
        asset.text = headline[:30]
        rsa.headlines.append(asset)
    for description in ad.get("descriptions", [])[:4]:
        asset = client.get_type("AdTextAsset")
        asset.text = description[:90]
        rsa.descriptions.append(asset)
    service.mutate_ad_group_ads(customer_id=customer_id, operations=[op])


def _real_create(norm: dict[str, Any], user_id: str | None = None) -> dict[str, Any]:
    """Live push via the google-ads API. The three safety rules are re-asserted
    in every _create_* helper (PAUSED / 1 EUR budget / SEARCH), never trusting
    the plan. On any failure (missing lib, auth, API rejection) returns a
    graceful live-error result instead of raising, so the agent stays responsive.

    NOTE: requires `google-ads` installed (uv sync) + valid credentials + a real
    (test) account. Needs a one-time smoke test against a Google Ads TEST account
    before trusting it on a production account.
    """
    try:
        client = _build_client(user_id)
    except ImportError as e:
        return _live_error(norm, f"google-ads Bibliothek nicht installiert ({e}). Bitte 'uv sync' bzw. 'uv add google-ads' ausfuehren.")
    except Exception as e:
        return _live_error(norm, f"Google Ads Client konnte nicht initialisiert werden: {e}")

    customer_id = "".join(ch for ch in norm["customer_id"] if ch.isdigit())
    if not customer_id:
        return _live_error(norm, "Kein gueltiges Ziel-Kundenkonto (customer_id) angegeben.")

    created = _empty_counts()
    out_campaigns: list[dict[str, Any]] = []
    try:
        for camp in norm["campaigns"]:
            budget_rn = _create_budget(client, customer_id, camp["name"])
            created["budgets"] += 1
            camp_rn = _create_campaign(
                client,
                customer_id,
                camp["name"],
                budget_rn,
                bid_strategy_kind=camp.get("bid_strategy_kind", "MANUAL_CPC"),
            )
            created["campaigns"] += 1
            ad_groups_out = []
            for ag in camp["ad_groups"]:
                ag_rn = _create_ad_group(client, customer_id, camp_rn, ag["name"])
                created["ad_groups"] += 1
                if ag["keywords"]:
                    _create_keywords(client, customer_id, ag_rn, ag["keywords"])
                    created["keywords"] += len(ag["keywords"])
                for ad in ag["ads"]:
                    _create_rsa(client, customer_id, ag_rn, ad)
                    created["ads"] += 1
                ad_groups_out.append({
                    "name": ag["name"],
                    "status": ag["status"],
                    "resource_name": ag_rn,
                    "keywords": ag["keywords"],
                    "ads": ag["ads"],
                })
            out_campaigns.append({
                "name": camp["name"],
                "status": camp["status"],
                "channel": camp["channel"],
                "daily_budget_eur": camp["daily_budget_eur"],
                "bid_strategy_raw": camp.get("bid_strategy_raw", ""),
                "bid_strategy_kind": camp.get("bid_strategy_kind", "MANUAL_CPC"),
                "budget_resource_name": budget_rn,
                "resource_name": camp_rn,
                "ad_groups": ad_groups_out,
            })
    except Exception as e:
        # Partial creation may have happened, but everything is PAUSED (harmless).
        return _live_error(
            norm,
            f"Anlegen wurde nach einem Fehler abgebrochen: {e}. Bereits angelegte "
            f"Elemente sind pausiert. Zaehler bis zum Fehler: {created}.",
        )

    return {
        "mode": "live",
        "dry_run": False,
        "customer_id": norm["customer_id"],
        "rules": norm["rules"],
        "created": created,
        "campaigns": out_campaigns,
        "warnings": norm["warnings"],
    }


def _plan_is_empty(norm: dict[str, Any]) -> bool:
    """True when every normalised campaign ends up with no ad groups.

    This is the classic 'agent only sent the kampagnen section' failure mode —
    pushing it through would create an empty campaign in Google Ads. Better to
    fail loudly so the agent retries with the full plan."""
    campaigns = norm.get("campaigns") or []
    if not campaigns:
        return True
    return all(not c.get("ad_groups") for c in campaigns)


def _plan_has_no_ads(norm: dict[str, Any]) -> bool:
    """True when the plan has keywords but zero ads across ALL ad groups.

    This catches the case where the agent includes keywords but omits the
    entire anzeigentexte/ads section — Google Ads would create ad groups that
    can never serve because they have no RSA."""
    total_keywords = 0
    total_ads = 0
    for camp in (norm.get("campaigns") or []):
        for ag in (camp.get("ad_groups") or []):
            total_keywords += len(ag.get("keywords") or [])
            total_ads += len(ag.get("ads") or [])
    return total_keywords > 0 and total_ads == 0


def build_search_campaigns(
    plan: dict[str, Any],
    customer_id: str | None = None,
    user_id: str | None = None,
) -> dict[str, Any]:
    """Public entry point: normalize the plan (enforcing the safety rules) and
    create the campaigns in the chosen target account via the mock or real
    backend."""
    norm = normalize_plan(plan, customer_id, user_id)

    _error_base = {
        "mode": "error",
        "dry_run": True,
        "customer_id": norm["customer_id"],
        "rules": norm["rules"],
        "created": _empty_counts(),
        "campaigns": [],
        "warnings": norm["warnings"],
    }

    if _plan_is_empty(norm):
        return {
            **_error_base,
            "error": (
                "Plan unvollstaendig: die Kampagnen enthalten keine Anzeigengruppen. "
                "Das passiert wenn create_search_campaigns nur mit der Sektion 'kampagnen' aufgerufen wird. "
                "Bitte das VOLLSTAENDIGE Plan-JSON uebergeben - inkl. 'keywords' und 'anzeigentexte' aus dem "
                "vorherigen Workflow - und die Renames aus dem Name-Editor in ALLEN drei Sektionen anwenden "
                "(kampagnen[].name, keywords[].kampagne/anzeigengruppe, anzeigentexte[].kampagne/anzeigengruppe)."
            ),
        }

    if _plan_has_no_ads(norm):
        return {
            **_error_base,
            "error": (
                "Plan unvollstaendig: Anzeigengruppen haben Keywords aber KEINE Anzeigen (RSA). "
                "Google Ads wuerde leere Anzeigengruppen anlegen die nie ausgespielt werden. "
                "Bitte die Sektion 'anzeigentexte' (oder 'ads') mit den RSA-Texten des Copywriters "
                "in das Plan-JSON aufnehmen. Jede Anzeigengruppe braucht mindestens eine Anzeige mit "
                "3+ Headlines und 2+ Descriptions."
            ),
        }

    if credentials_present(user_id):
        return _real_create(norm, user_id)
    return _mock_create(norm)


def test_connection(user_id: str | None = None) -> dict[str, Any]:
    """Probe the Google Ads connection for the settings page. Tries to list the
    accessible accounts and reports success/failure without raising."""
    if not credentials_present(user_id):
        return {
            "ok": False,
            "mode": "mock",
            "error": (
                "Zugangsdaten unvollstaendig - Developer-Token, Client-ID, "
                "Client-Secret und Refresh-Token werden benoetigt. (Ohne diese "
                "laeuft der Builder im Mock-Modus.)"
            ),
        }
    try:
        accounts = _live_list_accounts(user_id)
        return {"ok": True, "mode": "live", "count": len(accounts), "accounts": accounts}
    except ImportError as e:
        return {
            "ok": False,
            "mode": "live",
            "error": f"google-ads Bibliothek nicht installiert ({e}). Bitte 'uv sync' ausfuehren.",
        }
    except Exception as e:
        return {"ok": False, "mode": "live", "error": str(e)[:500]}
