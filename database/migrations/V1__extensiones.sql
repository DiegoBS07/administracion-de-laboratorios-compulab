-- btree_gist permite combinar igualdad (=) y traslape de rangos (&&) en una misma restricción
-- EXCLUDE: es la segunda barrera de concurrencia de ADR-0009. Viene incluida en la imagen postgres:14.
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;
