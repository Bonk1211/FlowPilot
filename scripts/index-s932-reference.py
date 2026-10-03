"""Import once, resume interrupted uploads, and reuse unchanged reference revisions."""

import argparse
import asyncio

from flowpilot.incidents.rag import index_reference, reference_content


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Inspect locally without uploading")
    parser.add_argument(
        "--allow-reference-upload",
        action="store_true",
        help="Allow this reference upload while preserving the incident data policy",
    )
    args = parser.parse_args()
    if args.dry_run:
        content = reference_content()
        print(
            f"{content.document_revision}: {len(content.passages)} exact S932 passages; "
            "secondary_summary, unverified. ASM bonder cases excluded. No upload performed."
        )
        return
    try:
        index = await index_reference(allow_reference_upload=args.allow_reference_upload)
    except Exception as error:
        # Provider exceptions can include secrets or source contents.
        print(
            str(error)
            if isinstance(error, ValueError)
            else "Indexing unavailable. Check provider access, migrations and retry to resume."
        )
        raise SystemExit(1) from None
    print(
        f"Reference {index['status']}: {len(index['documents'])} passages indexed. "
        "Set FLOWPILOT_INCIDENT_RAG_ENABLED=true and restart the API."
    )


if __name__ == "__main__":
    asyncio.run(main())
