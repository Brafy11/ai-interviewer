"""Write a minimal one-page PDF with resume text, for curl-testing the upload.

Builds raw PDF bytes by hand so it needs no PDF-writing dependency. The output
(sample_resume.pdf) is gitignored. Run from backend/:

    uv run python -m scripts.make_sample_pdf
"""

from pathlib import Path

OUTPUT = Path("sample_resume.pdf")

RESUME_LINES = [
    "Maria Lopez",
    "In-Home Caregiver",
    "",
    "Experience:",
    "Comfort Keepers of Austin, In-Home Caregiver, 2021 - Present",
    "- Assisted elderly clients with bathing, dressing, and grooming",
    "- Prepared meals and helped with bed-to-wheelchair transfers",
    "Taco Cabana, Food Service Worker, 2019 - 2021",
    "",
    "Skills: meal preparation, hygiene assistance, mobility transfers, companionship",
    "Certifications: CPR/First Aid (expired 2024)",
    "Languages: Bilingual English and Spanish",
    "Availability: Weekdays, daytime preferred",
]


def _escape(text: str) -> str:
    # Backslash and parentheses are special inside PDF string literals.
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _content_stream(lines: list[str]) -> bytes:
    parts = ["BT", "/F1 12 Tf", "72 720 Td"]
    for i, line in enumerate(lines):
        if i > 0:
            parts.append("0 -16 Td")  # move down one line
        parts.append(f"({_escape(line)}) Tj")
    parts.append("ET")
    return "\n".join(parts).encode("latin-1")


def build_pdf(lines: list[str]) -> bytes:
    content = _content_stream(lines)
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length " + str(len(content)).encode() + b" >>\nstream\n" + content + b"\nendstream",
    ]

    pdf = b"%PDF-1.4\n"
    offsets = []
    for number, obj in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf += f"{number} 0 obj\n".encode() + obj + b"\nendobj\n"

    xref_offset = len(pdf)
    size = len(objects) + 1  # +1 for the free object 0
    pdf += f"xref\n0 {size}\n".encode()
    pdf += b"0000000000 65535 f \n"
    for offset in offsets:
        pdf += f"{offset:010d} 00000 n \n".encode()
    pdf += b"trailer\n" + f"<< /Size {size} /Root 1 0 R >>\n".encode()
    pdf += b"startxref\n" + f"{xref_offset}\n".encode() + b"%%EOF"
    return pdf


def main() -> None:
    OUTPUT.write_bytes(build_pdf(RESUME_LINES))
    print(f"Wrote {OUTPUT} ({OUTPUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
