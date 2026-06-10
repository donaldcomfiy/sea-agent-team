# Skill loader. Skills are markdown files under app/skills/<name>.md that
# carry domain knowledge an agent always consults — frameworks, playbooks,
# anti-patterns, industry defaults. Kept separate from the agent code so a
# non-developer (or future-you with fresh ideas) can edit a skill without
# touching agent.py.
#
# The skill text is read from disk on each call so a backend restart picks
# up edits without having to re-import the module — useful while iterating.

import os
from functools import lru_cache

_SKILLS_DIR = os.path.dirname(os.path.abspath(__file__))


def load_skill(name: str) -> str:
    """Return the markdown contents of a skill file as a string.

    Args:
        name: skill file basename without extension, e.g. "strategy_skill".

    Returns:
        The full file contents, or an empty string if the file is missing
        (so a typo or pending file never crashes agent creation).
    """
    path = os.path.join(_SKILLS_DIR, f"{name}.md")
    try:
        with open(path, encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return ""


@lru_cache(maxsize=8)
def cached_skill(name: str) -> str:
    """Same as load_skill but cached per process — for hot paths where the
    file shouldn't be re-read on every call. Backend restart still re-reads."""
    return load_skill(name)
