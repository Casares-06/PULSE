"""Carga, normaliza y resume el historial ampliado de Spotify."""

from __future__ import annotations

import json
import zipfile
from pathlib import Path

import pandas as pd


TIMEZONE = "Europe/Madrid"
SENSITIVE_COLUMNS = {
    "ip_addr",
    "username",
    "user_agent_decrypted",
}


def find_spotify_zip(project_dir: Path, explicit_path: str | None = None) -> Path:
    """Localiza el ZIP indicado o uno situado en data/raw."""
    if explicit_path:
        candidate = Path(explicit_path).expanduser()
        if candidate.is_file():
            return candidate
        raise FileNotFoundError(f"No se encuentra el ZIP: {candidate}")

    candidates = sorted((project_dir / "data" / "raw").glob("*.zip"))

    if not candidates:
        raise FileNotFoundError(
            "No se encontró ningún ZIP. Usa --zip RUTA o cópialo en data/raw."
        )
    return candidates[0]


def _read_json_group(zip_path: Path, marker: str) -> pd.DataFrame:
    """Lee y concatena los JSON cuyo nombre contiene ``marker``."""
    frames: list[pd.DataFrame] = []
    with zipfile.ZipFile(zip_path) as archive:
        names = sorted(
            name
            for name in archive.namelist()
            if marker in name and name.lower().endswith(".json")
        )
        for name in names:
            with archive.open(name) as file:
                records = json.load(file)
            if not isinstance(records, list):
                raise ValueError(f"{name} no contiene una lista de registros JSON")
            frame = pd.DataFrame(records)
            frame["source_file"] = Path(name).name
            frames.append(frame)

    if not frames:
        return pd.DataFrame()
    return pd.concat(frames, ignore_index=True, sort=False)


def load_spotify_export(zip_path: Path) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Devuelve por separado los registros de audio y vídeo."""
    audio = _read_json_group(zip_path, "Streaming_History_Audio_")
    video = _read_json_group(zip_path, "Streaming_History_Video_")
    if audio.empty:
        raise ValueError("El ZIP no contiene historial ampliado de audio")
    return audio, video


def prepare_history(raw: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Normaliza el historial y devuelve versiones auditada y deduplicada."""
    df = raw.copy()

    raw_columns = [column for column in df.columns if column != "source_file"]
    df["is_exact_duplicate"] = df.duplicated(raw_columns, keep=False)
    df["is_duplicate_after_first"] = df.duplicated(raw_columns, keep="first")

    df["played_at_utc"] = pd.to_datetime(df["ts"], errors="coerce", utc=True)
    df["played_at_local"] = df["played_at_utc"].dt.tz_convert(TIMEZONE)
    df["ms_played"] = pd.to_numeric(df["ms_played"], errors="coerce").fillna(0)
    df["ms_played"] = df["ms_played"].clip(lower=0).astype("int64")

    for column in ["skipped", "shuffle", "offline", "incognito_mode"]:
        if column in df.columns:
            df[column] = df[column].astype("boolean")

    track_uri = df.get("spotify_track_uri", pd.Series(pd.NA, index=df.index))
    episode_uri = df.get("spotify_episode_uri", pd.Series(pd.NA, index=df.index))
    audiobook_uri = df.get("audiobook_chapter_uri", pd.Series(pd.NA, index=df.index))

    df["content_type"] = "unknown"
    df.loc[track_uri.notna(), "content_type"] = "track"
    df.loc[episode_uri.notna(), "content_type"] = "episode"
    df.loc[audiobook_uri.notna(), "content_type"] = "audiobook"

    df["item_uri"] = track_uri.fillna(episode_uri).fillna(audiobook_uri)
    df["item_name"] = df.get("master_metadata_track_name").fillna(
        df.get("episode_name")
    ).fillna(df.get("audiobook_chapter_title"))
    df["creator_name"] = df.get("master_metadata_album_artist_name").fillna(
        df.get("episode_show_name")
    ).fillna(df.get("audiobook_title"))
    df["collection_name"] = df.get("master_metadata_album_album_name").fillna(
        df.get("episode_show_name")
    ).fillna(df.get("audiobook_title"))

    df["seconds_played"] = df["ms_played"] / 1_000
    df["minutes_played"] = df["ms_played"] / 60_000
    df["hours_played"] = df["ms_played"] / 3_600_000
    df["played_30_seconds"] = df["ms_played"].ge(30_000)
    df["very_short_play"] = df["ms_played"].lt(10_000)

    local_naive = df["played_at_local"].dt.tz_localize(None)
    df["played_day"] = local_naive.dt.floor("D")
    df["played_month"] = local_naive.dt.to_period("M").dt.to_timestamp()
    df["year"] = local_naive.dt.year.astype("Int64")
    df["month"] = local_naive.dt.month.astype("Int64")
    df["hour"] = local_naive.dt.hour.astype("Int64")
    df["weekday_number"] = local_naive.dt.dayofweek.astype("Int64")
    weekday_names = {
        0: "Lunes",
        1: "Martes",
        2: "Miércoles",
        3: "Jueves",
        4: "Viernes",
        5: "Sábado",
        6: "Domingo",
    }
    df["weekday"] = df["weekday_number"].map(weekday_names)

    df = df.drop(columns=list(SENSITIVE_COLUMNS), errors="ignore")
    df = df.sort_values("played_at_utc", ignore_index=True)

    # Una sesión nueva comienza tras más de 30 minutos sin registros.
    gap = df["played_at_local"].diff()
    df["new_session"] = gap.isna() | gap.gt(pd.Timedelta(minutes=30))
    df["session_id"] = df["new_session"].cumsum().astype("int64")

    audited = df
    clean = df.loc[~df["is_duplicate_after_first"]].reset_index(drop=True)
    return audited, clean


def _ranking(
    df: pd.DataFrame,
    group_columns: list[str],
    unique_column: str | None = None,
) -> pd.DataFrame:
    aggregations: dict[str, tuple[str, str]] = {
        "events": ("item_name", "size"),
        "streams_30s": ("played_30_seconds", "sum"),
        "minutes": ("minutes_played", "sum"),
        "first_play": ("played_at_local", "min"),
        "last_play": ("played_at_local", "max"),
    }
    if unique_column:
        aggregations["unique_items"] = (unique_column, "nunique")

    result = (
        df.groupby(group_columns, dropna=False)
        .agg(**aggregations)
        .reset_index()
        .sort_values(["minutes", "streams_30s"], ascending=False)
    )
    result["minutes"] = result["minutes"].round(2)
    return result


def create_exports(history: pd.DataFrame, output_dir: Path) -> dict[str, Path]:
    """Genera las tablas principales en CSV."""
    output_dir.mkdir(parents=True, exist_ok=True)
    music = history.loc[history["content_type"].eq("track")].copy()

    tables = {
        "top_tracks": _ranking(
            music,
            ["item_uri", "item_name", "creator_name", "collection_name"],
        ),
        "top_artists": _ranking(music, ["creator_name"], "item_uri"),
        "top_albums": _ranking(
            music, ["collection_name", "creator_name"], "item_uri"
        ),
        "by_year": (
            music.groupby("year", dropna=False)
            .agg(
                events=("item_name", "size"),
                streams_30s=("played_30_seconds", "sum"),
                minutes=("minutes_played", "sum"),
                unique_tracks=("item_uri", "nunique"),
                unique_artists=("creator_name", "nunique"),
            )
            .reset_index()
        ),
        "by_month": (
            music.groupby("played_month", dropna=False)
            .agg(
                events=("item_name", "size"),
                streams_30s=("played_30_seconds", "sum"),
                minutes=("minutes_played", "sum"),
            )
            .reset_index()
        ),
    }

    written: dict[str, Path] = {}
    for name, table in tables.items():
        path = output_dir / f"{name}.csv"
        table.to_csv(path, index=False, encoding="utf-8-sig")
        written[name] = path
    return written


def build_quality_report(
    audited: pd.DataFrame,
    clean: pd.DataFrame,
    video_count: int,
    zip_path: Path,
) -> dict[str, object]:
    """Crea un resumen serializable de cobertura y calidad."""
    return {
        "source_zip": str(zip_path),
        "audio_records_raw": int(len(audited)),
        "audio_records_clean": int(len(clean)),
        "exact_duplicate_extras": int(audited["is_duplicate_after_first"].sum()),
        "minutes_raw": round(float(audited["minutes_played"].sum()), 2),
        "minutes_clean": round(float(clean["minutes_played"].sum()), 2),
        "duplicate_minutes_removed": round(
            float(
                audited.loc[
                    audited["is_duplicate_after_first"], "minutes_played"
                ].sum()
            ),
            2,
        ),
        "video_records_separate": int(video_count),
        "invalid_dates": int(clean["played_at_utc"].isna().sum()),
        "first_play_utc": str(clean["played_at_utc"].min()),
        "last_play_utc": str(clean["played_at_utc"].max()),
        "hours_clean": round(float(clean["hours_played"].sum()), 2),
        "streams_at_least_30s": int(clean["played_30_seconds"].sum()),
        "track_events": int(clean["content_type"].eq("track").sum()),
        "episode_events": int(clean["content_type"].eq("episode").sum()),
    }
