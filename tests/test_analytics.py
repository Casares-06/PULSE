"""Pruebas unitarias de los cálculos principales."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

import pandas as pd


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from analytics import streak_stats, top_table  # noqa: E402


class AnalyticsTests(unittest.TestCase):
    def test_top_table_orders_by_minutes(self) -> None:
        frame = pd.DataFrame(
            {
                "creator_name": ["B", "A", "A"],
                "item_name": ["b", "a1", "a2"],
                "minutes_played": [5.0, 4.0, 3.0],
                "played_30_seconds": [True, True, False],
                "played_at_local": pd.to_datetime(
                    ["2026-01-01", "2026-01-02", "2026-01-03"], utc=True
                ),
            }
        )
        ranking = top_table(frame, ["creator_name"])
        self.assertEqual(ranking.iloc[0]["creator_name"], "A")
        self.assertEqual(ranking.iloc[0]["posición"], 1)
        self.assertEqual(ranking.iloc[0]["minutos"], 7.0)

    def test_streak_stats_finds_longest_run(self) -> None:
        frame = pd.DataFrame(
            {
                "played_day": pd.to_datetime(
                    ["2026-01-01", "2026-01-02", "2026-01-04", "2026-01-05", "2026-01-06"]
                )
            }
        )
        result = streak_stats(frame)
        self.assertEqual(result["longest"], 3)
        self.assertEqual(result["current"], 3)


if __name__ == "__main__":
    unittest.main()

