"""Copy product photos from Downloads into backend/uploads/menu/ — one photo per file."""
from __future__ import annotations

import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(r"C:\Users\COMPUTER PANEL\Downloads\new pic")
OUT = ROOT / "uploads" / "menu"

# WhatsApp sequence number -> catalog filename (unique photos only)
MAPPING: dict[tuple[str, int], str] = {
    ("25", 1): "iced-spanish-latte.jpg",
    ("25", 2): "iced-americano.jpg",
    ("25", 3): "iced-tea.jpg",
    ("25", 4): "caramel-macchiato.jpg",
    ("25", 5): "dirty-chai.jpg",
    ("25", 6): "latte.jpg",
    ("25", 7): "cappuccino.jpg",
    ("25", 8): "iced-lavender-latte.jpg",
    ("25", 9): "flat-white.jpg",
    ("25", 10): "latte-macchiato.jpg",
    ("25", 11): "spanish-latte.jpg",
    ("25", 12): "iced-matcha.jpg",
    ("25", 13): "lavender-latte.jpg",
    ("24", 2): "lotus-milkshake.jpg",
    ("24", 3): "caramel-frappe.jpg",
    ("24", 4): "hot-chocolate.jpg",
    ("24", 6): "cookies-frappe.jpg",
    ("24", 7): "vanilla-milkshake.jpg",
    ("24", 8): "juice.jpg",
    ("24", 9): "mango-milkshake.jpg",
    ("24", 10): "vanilla-frappe.jpg",
    ("24", 11): "strawberry-frappe.jpg",
    ("24", 12): "mochaccino.jpg",
    ("24", 13): "iced-latte-macchiato.jpg",
    ("24", 14): "iced-chai-latte.jpg",
    ("24", 15): "white-choco-frappe.jpg",
}


def long(path: Path) -> str:
    s = str(path.resolve())
    return s if s.startswith("\\\\?\\") else f"\\\\?\\{s}"


def find_source(batch: str, num: int) -> Path | None:
    pat = re.compile(
        rf"WhatsApp Image 2026-08-28 at 11\.51\.{batch} AM \({num}\)\.jpe?g$",
        re.I,
    )
    for f in SOURCE.iterdir():
        if pat.match(f.name):
            return f
    return None


def main() -> None:
    if not SOURCE.is_dir():
        raise SystemExit(f"Source folder not found: {SOURCE}")

    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.iterdir():
        if old.is_file():
            old.unlink()

    copied = 0
    missing: list[str] = []
    for (batch, num), dest in MAPPING.items():
        src = find_source(batch, num)
        if not src:
            missing.append(f"{batch} AM ({num}) -> {dest}")
            continue
        shutil.copyfile(long(src), long(OUT / dest))
        copied += 1
        print(f"OK  {dest}")

    print(f"\nCopied {copied} unique images to {OUT}")
    if missing:
        print("Missing:")
        for m in missing:
            print(f"  - {m}")


if __name__ == "__main__":
    main()
