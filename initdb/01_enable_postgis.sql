-- Se ejecuta contra POSTGRES_DB (el que pusiste en el compose)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
-- Opcionales:
-- CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
-- CREATE EXTENSION IF NOT EXISTS postgis_tiger_geocoder;  -- requiere datos TIGER/Line (USA)
