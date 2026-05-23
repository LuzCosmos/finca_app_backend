# Módulo `massive-events` (NestJS)

API REST de eventos masivos, simple events y aplicación a ganado.

Documentación de producto: [`finca_app_docs/features/04-massive-events-module.md`](../../../../finca_app_docs/features/04-massive-events-module.md).

## Cliente móvil (2026-05)

La app móvil opera **online-only** para evento masivo: usa `POST /massive-events`, `POST /simple-events`, `POST /cattle/apply-events` (body: `applied.cattleNumber`), `PUT /massive-events/close/:id`, etc.

Los endpoints de sincronización por lote **no son consumidos por móvil** en esta fase (se mantienen para una futura reactivación offline):

- `POST /massive-events/sync`
- `POST /simple-events/sync`
- `POST /cattle/animal-simple-events/sync` (y sync de marcas en su módulo, si aplica)

No están deprecados; solo documentados como no usados por el cliente móvil actual.
