"""Procesa el ZIP de Spotify y crea los archivos usados por el dashboard."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from spotify_pipeline import (
    build_quality_report,
    create_exports,
    find_spotify_zip,
    load_spotify_export,
    prepare_history,
)


PROJECT_DIR = Path(__file__).resolve().parents[1]
PROCESSED_DIR = PROJECT_DIR / "data" / "processed"
TABLES_DIR = PROJECT_DIR / "outputs" / "tables"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Procesa el historial de Spotify")
    parser.add_argument(
        "--zip",
        dest="zip_path",
        help="Ruta opcional al ZIP del historial ampliado",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    zip_path = find_spotify_zip(PROJECT_DIR, args.zip_path)
    print(f"Leyendo: {zip_path}")

    raw_audio, raw_video = load_spotify_export(zip_path)
    audited, clean = prepare_history(raw_audio)

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    audited_path = PROCESSED_DIR / "spotify_history_audited.parquet"
    clean_path = PROCESSED_DIR / "spotify_history.parquet"
    video_path = PROCESSED_DIR / "spotify_video_history.parquet"

    audited.to_parquet(audited_path, index=False)
    clean.to_parquet(clean_path, index=False)

    if not raw_video.empty:
        video_audited, _ = prepare_history(raw_video)
        video_audited.to_parquet(video_path, index=False)

    create_exports(clean, TABLES_DIR)
    report = build_quality_report(
        audited, clean, len(raw_video), zip_path
    )
    report_path = PROCESSED_DIR / "quality_report.json"
    report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print("\nProceso completado")
    for key, value in report.items():
        print(f"- {key}: {value}")
    print(f"\nHistorial limpio: {clean_path}")
    print(f"Informe de calidad: {report_path}")
    print(f"Tablas CSV: {TABLES_DIR}")


if __name__ == "__main__":
    main()

