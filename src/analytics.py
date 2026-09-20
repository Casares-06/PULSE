"""Cálculos reutilizables para la aplicación de estadísticas."""

from __future__ import annotations

import pandas as pd


def top_table(
    frame: pd.DataFrame,
    dimensions: list[str],
    sort_by: str = "minutos",
) -> pd.DataFrame:
    """Crea un ranking completo por minutos, reproducciones o eventos."""
    if frame.empty:
        return pd.DataFrame(
            columns=dimensions + ["minutos", "horas", "reproducciones_30s", "eventos"]
        )
    result = (
        frame.groupby(dimensions, dropna=False)
        .agg(
            minutos=("minutes_played", "sum"),
            reproducciones_30s=("played_30_seconds", "sum"),
            eventos=("item_name", "size"),
            primera_escucha=("played_at_local", "min"),
            última_escucha=("played_at_local", "max"),
        )
        .reset_index()
    )
    result["horas"] = result["minutos"] / 60
    result = result.sort_values([sort_by, "minutos"], ascending=False).reset_index(drop=True)
    result.insert(0, "posición", range(1, len(result) + 1))
    return result


def streak_stats(frame: pd.DataFrame) -> dict[str, object]:
    """Calcula rachas sobre los días con al menos una reproducción."""
    days = pd.Series(pd.to_datetime(frame["played_day"].dropna().unique())).sort_values()
    if days.empty:
        return {"longest": 0, "current": 0, "start": None, "end": None}

    groups = days.diff().dt.days.ne(1).cumsum()
    streaks = days.groupby(groups).agg(["min", "max", "count"])
    best = streaks.loc[streaks["count"].idxmax()]
    current = streaks.iloc[-1]
    return {
        "longest": int(best["count"]),
        "current": int(current["count"]),
        "start": best["min"],
        "end": best["max"],
    }


def session_table(frame: pd.DataFrame) -> pd.DataFrame:
    """Resume las sesiones aproximadas separadas por pausas de 30 minutos."""
    if frame.empty:
        return pd.DataFrame()
    sessions = (
        frame.groupby("session_id")
        .agg(
            inicio=("played_at_local", "min"),
            fin=("played_at_local", "max"),
            minutos=("minutes_played", "sum"),
            eventos=("item_name", "size"),
            artistas=("creator_name", "nunique"),
            elementos=("item_uri", "nunique"),
        )
        .reset_index()
    )
    sessions["duración_reloj_min"] = (
        sessions["fin"] - sessions["inicio"]
    ).dt.total_seconds() / 60
    return sessions.sort_values("minutos", ascending=False)


def daily_table(frame: pd.DataFrame) -> pd.DataFrame:
    """Agrega los eventos por día."""
    return (
        frame.groupby("played_day", as_index=False)
        .agg(
            minutos=("minutes_played", "sum"),
            eventos=("item_name", "size"),
            reproducciones_30s=("played_30_seconds", "sum"),
            artistas=("creator_name", "nunique"),
        )
        .sort_values("played_day")
    )


def discovery_table(frame: pd.DataFrame, entity: str) -> pd.DataFrame:
    """Cuenta artistas o canciones escuchados por primera vez cada mes."""
    first_seen = (
        frame.dropna(subset=[entity])
        .groupby(entity, as_index=False)["played_at_local"]
        .min()
    )
    local_naive = first_seen["played_at_local"].dt.tz_localize(None)
    first_seen["mes"] = local_naive.dt.to_period("M").dt.to_timestamp()
    return first_seen.groupby("mes", as_index=False).size().rename(columns={"size": "nuevos"})


def percentage_true(frame: pd.DataFrame, column: str) -> float:
    """Porcentaje seguro de valores verdaderos."""
    if column not in frame or frame.empty:
        return 0.0
    return float(frame[column].fillna(False).mean() * 100)

