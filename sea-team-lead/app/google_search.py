# Google Search Autocomplete — public, unauthenticated endpoint that returns
# the live ranked suggestion list the user sees in the search dropdown. Used
# by the search_intent_agent to ground its query ideation in real Google
# data instead of model hallucination.
#
# Endpoint: https://suggestqueries.google.com/complete/search
# Response shape (client=firefox): [<echoed query>, [<suggestion 1>, ...]]
#
# Not officially documented as an API but stable for over a decade and
# routinely consumed by SEO tools. No quota in practice for our workflow
# (10–30 seeds per pipeline run).

import json

import requests

AUTOCOMPLETE_URL = "https://suggestqueries.google.com/complete/search"
# Connect-/read-timeout. The endpoint is fast but the first request after
# idle sometimes takes 5+ seconds; 15s read-timeout absorbs that without ever
# being noticeable to the user.
_DEFAULT_TIMEOUT = (5, 15)


def google_autocomplete(query: str, language: str = "de", geo: str = "DE") -> str:
    """Return the live Google search-suggestion list for a query.

    Calls the public Google Autocomplete endpoint (no auth) and returns the
    same ranked dropdown a user would see when typing the query into Google.
    Use this to discover the real phrasings users type — invaluable for
    grounding keyword and copy decisions in actual search behaviour instead
    of guessing what people might search.

    Args:
        query: Seed query string (z. B. "esn flexpresso", "vitamin d3 k2").
        language: ISO-639-1 language code for `hl` (default "de" / German).
        geo: ISO-3166 country code for `gl` (default "DE" / Germany).

    Returns:
        JSON string with the shape
        `{"query": "...", "suggestions": ["...", "..."], "language": "de", "geo": "DE"}`.
        On any error returns `{"query": "...", "suggestions": [], "error": "..."}`
        — the caller can treat that as "no data" without raising.
    """
    payload: dict = {"query": query, "language": language, "geo": geo, "suggestions": []}
    try:
        resp = requests.get(
            AUTOCOMPLETE_URL,
            params={"client": "firefox", "q": query, "hl": language, "gl": geo},
            timeout=_DEFAULT_TIMEOUT,
            headers={"User-Agent": "Mozilla/5.0 (sea-team-lead search_intent_agent)"},
        )
        if resp.status_code != 200:
            payload["error"] = f"HTTP {resp.status_code}"
            return json.dumps(payload, ensure_ascii=False)
        data = resp.json()
        # Format: [query_echo, [s1, s2, ...]]. Be defensive: tolerate unexpected
        # shapes and just return an empty suggestion list in that case.
        suggestions: list[str] = []
        if isinstance(data, list) and len(data) >= 2 and isinstance(data[1], list):
            suggestions = [str(s) for s in data[1] if isinstance(s, (str, int, float))]
        payload["suggestions"] = suggestions
        return json.dumps(payload, ensure_ascii=False)
    except requests.exceptions.RequestException as e:
        payload["error"] = f"request_failed: {e}"
        return json.dumps(payload, ensure_ascii=False)
    except (ValueError, json.JSONDecodeError) as e:
        payload["error"] = f"parse_failed: {e}"
        return json.dumps(payload, ensure_ascii=False)
