-- Sesiones propias de CompuLab (ADR-0008). Se guarda la huella SHA-256 del token, nunca el token.
CREATE TABLE sesiones (
  huella_token  text PRIMARY KEY,
  id_usuario    text NOT NULL,
  nombre        text NOT NULL,
  roles         jsonb NOT NULL,
  vence_en      timestamptz NOT NULL
);
CREATE INDEX sesiones_por_vencimiento ON sesiones (vence_en);

-- Avisos en la app (puerto Notificador, 8.3): se registran en la transacción del caso de uso.
CREATE TABLE avisos (
  id             bigserial PRIMARY KEY,
  destinatario   text NOT NULL,
  tipo           text NOT NULL,
  datos          jsonb NOT NULL,
  registrado_en  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX avisos_por_destinatario ON avisos (destinatario, registrado_en DESC);
