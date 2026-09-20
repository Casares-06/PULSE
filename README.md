# Pulse — Spotify Stats

Aplicación web privada para analizar el historial ampliado de Spotify sin subir
los datos personales a servicios externos. El ZIP se abre en la memoria del
navegador, no se copia a almacenamiento local y desaparece al cerrar o recargar
la pestaña. Incluye rankings, evolución histórica, hábitos, sesiones, rachas,
descubrimiento, podcasts y exploración detallada.

## Web pública

[Abrir PULSE](https://casares-06.github.io/PULSE/)

La web se publica automáticamente con GitHub Pages cada vez que se actualiza la
rama `main`.

## Web privada (recomendada)

La versión web no necesita servidor, base de datos, cuenta ni API de pago.

```powershell
pnpm install
pnpm dev
```

Para crear la versión estática publicable:

```powershell
pnpm build
```

### Garantías de privacidad

- No existe ningún endpoint de subida ni backend.
- No se usa `localStorage`, IndexedDB, cookies o analítica.
- La política de seguridad bloquea conexiones de red desde la aplicación.
- El historial vive únicamente en RAM durante la pestaña actual.
- Se validan rutas, tamaños, expansión y contenido del ZIP antes de usarlo.
- IP, nombre de usuario y agente de usuario nunca se incorporan al modelo.

## Funciones

- Portada personal con minutos, horas, récords y evolución.
- Rankings completos de artistas, canciones y álbumes.
- Comparación anual y series diarias, mensuales y anuales.
- Mapa de calor por día y hora, plataformas, países y comportamiento.
- Sesiones aproximadas, días activos y rachas consecutivas.
- Descubrimiento y concentración de preferencias.
- Estadísticas independientes para podcasts.
- Buscador de reproducciones y exportación de resultados.
- Auditoría de duplicados, cobertura y fechas del archivo.

## Versión Python local

La aplicación original de Streamlit se conserva como referencia para validar
los cálculos y desarrollar métricas nuevas.

### Procesar los datos

```powershell
.\.venv\Scripts\python.exe .\src\process_data.py --zip "C:\ruta\a\my_spotify_data.zip"
```

### Abrir el dashboard

```powershell
.\.venv\Scripts\python.exe -m streamlit run .\app.py
```

El navegador se abre normalmente en `http://localhost:8501`.

En Windows también puedes ejecutar `run_app.bat`.

### Archivos generados

- `data/processed/spotify_history_audited.parquet`: conserva los registros y
  las marcas de duplicados, sin la IP.
- `data/processed/spotify_history.parquet`: historial deduplicado usado para
  calcular las métricas.
- `data/processed/spotify_video_history.parquet`: historial de vídeo separado.
- `data/processed/quality_report.json`: resumen de cobertura y calidad.
- `outputs/tables/*.csv`: rankings y resúmenes exportables.

La regla de `30 segundos` es un criterio analítico configurable. Los minutos
se calculan siempre con el campo real `ms_played` proporcionado por Spotify.

## Privacidad y Git

El repositorio ignora el ZIP original, los Parquet procesados y las tablas CSV
personales. Solo se versionan el código, la documentación y la configuración.

## Pruebas

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
pnpm test
```

Para comprobar manualmente una exportación real sin guardar resultados:

```powershell
$env:PULSE_TEST_ZIP="C:\ruta\a\my_spotify_data.zip"
pnpm test
```
