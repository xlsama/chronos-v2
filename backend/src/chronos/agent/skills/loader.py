import re
from pathlib import Path

from loguru import logger
from pydantic import BaseModel, Field


class SkillMeta(BaseModel):
    name: str
    description: str
    category: str | None = None
    tags: list[str] = Field(default_factory=list)
    required_mcp_servers: list[str] = Field(default_factory=list)
    risk_level: str = "medium"
    path: str = ""


def parse_yaml_frontmatter(filepath: Path) -> dict:
    text = filepath.read_text(encoding="utf-8")
    match = re.match(r"^---\s*\n(.*?)\n---", text, re.DOTALL)
    if not match:
        return {}

    frontmatter = {}
    for line in match.group(1).strip().splitlines():
        if ":" not in line:
            continue
        key, _, value = line.partition(":")
        key = key.strip()
        value = value.strip().strip('"').strip("'")

        if value.startswith("[") and value.endswith("]"):
            items = value[1:-1]
            frontmatter[key] = [item.strip().strip('"').strip("'") for item in items.split(",") if item.strip()]
        else:
            frontmatter[key] = value

    return frontmatter


class SkillLoader:
    def __init__(self, skills_dir: str | Path):
        self.skills_dir = Path(skills_dir).resolve()
        self._catalog: list[SkillMeta] = []

    @property
    def catalog(self) -> list[SkillMeta]:
        return self._catalog

    def load_catalog(self) -> None:
        if not self.skills_dir.exists():
            logger.warning(f"Skills directory not found: {self.skills_dir}")
            return

        self._catalog = []
        for skill_dir in sorted(self.skills_dir.iterdir()):
            if not skill_dir.is_dir():
                continue
            skill_md = skill_dir / "SKILL.md"
            if not skill_md.exists():
                continue

            frontmatter = parse_yaml_frontmatter(skill_md)
            if not frontmatter.get("name"):
                frontmatter["name"] = skill_dir.name

            self._catalog.append(
                SkillMeta(
                    name=frontmatter.get("name", skill_dir.name),
                    description=frontmatter.get("description", ""),
                    category=frontmatter.get("category"),
                    tags=frontmatter.get("tags", []),
                    required_mcp_servers=frontmatter.get("required_mcp_servers", []),
                    risk_level=frontmatter.get("risk_level", "medium"),
                    path=str(skill_dir),
                )
            )
            logger.info(f"Loaded skill metadata: {frontmatter.get('name', skill_dir.name)}")

    def match(self, category: str | None = None, tags: list[str] | None = None) -> list[SkillMeta]:
        results = []
        for skill in self._catalog:
            if category and skill.category == category:
                results.append(skill)
            elif tags and any(t in skill.tags for t in tags):
                results.append(skill)
        return results

    def load_full_content(self, skill_name: str) -> str | None:
        skill_dir = self.skills_dir / skill_name
        skill_md = skill_dir / "SKILL.md"
        if not skill_md.exists():
            return None

        content = skill_md.read_text(encoding="utf-8")

        refs_dir = skill_dir / "references"
        if refs_dir.exists():
            for ref in sorted(refs_dir.glob("*.md")):
                content += f"\n\n## Reference: {ref.stem}\n{ref.read_text(encoding='utf-8')}"

        return content
