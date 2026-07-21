-- Correcciones manuales de clasificacion.
--
-- Se aplican ANTES de las reglas automaticas y mandan sobre ellas.
-- Sobreviven a toda reingesta: nunca se borran al cargar un mes nuevo.
--
-- Para aplicarlas:
--     cd CADAM/scripts
--     python ingest.py --correcciones
--
-- Este archivo se versiona en git, asi que queda registro de quien
-- cambio que clasificacion y cuando.

-- ---------------------------------------------------------------------
-- MODELOS: grafias distintas del mismo modelo
-- ---------------------------------------------------------------------
-- La regla automatica ya unifica los modelos que solo difieren en
-- espacios, guiones, barras, comas o puntos (121 grupos en jul-2026,
-- entre ellos 'BYD SONG PLUS DM I' -> 'SONG PLUS DMI' y
-- 'TOYOTA HILUX DC 4X4 SRV AUT.' -> 'HILUX D/C 4X4 SRV AUT').
--
-- Lo que NO unifica sola es el '+', porque a veces distingue modelos de
-- verdad y unir de mas es peor que unir de menos:
--     LEXUS 'RX450H+'                          es el PHEV, NO es 'RX450H'
--     MERCEDES BENZ 'AMG GLE 53 HYBRID 4MATIC+' otra traccion
-- Esos dos quedan separados a proposito.
--
-- Los de abajo si son la misma unidad: el '+' es ruido de carga (JAC
-- escribe el trim con y sin '+', y Mercedes escribe la cantidad de
-- asientos como '15 + 1', '15+1' o '15 1'). Canonico = la grafia mas
-- frecuente, igual criterio que la regla automatica.

INSERT OR REPLACE INTO correccion_modelo (marca, alias, modelo, nota) VALUES
  ('JAC', 'JS4 1.5T + CVT ADVANCE ADAS', 'JS4 1.5T CVT ADVANCE ADAS',
   'El + es ruido de carga, mismo trim'),
  -- CRITERIO, no dato: 'ADVANCE AD' parece 'ADVANCE ADAS' truncado en la
  -- carga de la DNRA. Son 3 unidades. Si el equipo comercial confirma que
  -- es otro trim, borrar esta linea y volver a correr la ingesta.
  ('JAC', 'JS4 1.5T + CVT ADVANCE AD', 'JS4 1.5T CVT ADVANCE ADAS',
   'Nombre truncado en el origen (criterio, confirmar con comercial)'),
  ('JAC', 'JS4 1.5T + CVT LUXURY', 'JS4 1.5T CVT LUXURY',
   'El + es ruido de carga, mismo trim'),
  ('JAC', 'SUNRAY 161 MINIBUS', 'SUNRAY 16+1 MINIBUS',
   '16+1 = 16 asientos mas conductor; 161 es la misma unidad mal escrita'),
  ('MERCEDES BENZ', 'SPRINTER 414 CDI 15 + 1', 'SPRINTER 414 CDI 15 1',
   'Cantidad de asientos escrita distinto, misma unidad'),
  ('MERCEDES BENZ', 'SPRINTER 415 CDI 15+1', 'SPRINTER 415 CDI 15 1',
   'Cantidad de asientos escrita distinto, misma unidad'),
  ('MERCEDES BENZ', 'SPRINTER 514 CDI 19+1', 'SPRINTER 514 CDI 19 1',
   'Cantidad de asientos escrita distinto, misma unidad');

-- ---------------------------------------------------------------------
-- MARCAS
-- ---------------------------------------------------------------------
-- Los alias conocidos (GWM/GREAT WALL, MMC/MITSUBISHI, JETUOR/JETOUR,
-- LINK&CO/LYNK&CO) ya estan en cadam/normalize.py. Agregar aca solo los
-- que aparezcan despues.

-- INSERT OR REPLACE INTO correccion_marca (alias, marca, nota) VALUES
--   ('ALIAS', 'MARCA CANONICA', 'por que');

-- ---------------------------------------------------------------------
-- TECNOLOGIA POR MODELO
-- ---------------------------------------------------------------------
-- La fuente clasifica como ICE muchos modelos cuyo NOMBRE dice
-- explicitamente la tecnologia. Confirmado por el usuario a partir de
-- 'BYD SONG PRO DMI', que figuraba como ICE en 26 unidades y como PHEV
-- en 76 -- siendo el mismo auto (DM-i es la denominacion PHEV de BYD).
--
-- Estas 125 lineas se derivaron del nombre del modelo con tokens
-- inequivocos, en este orden de prioridad:
--     PHEV | DM-I (BYD) | PLUG-IN   -> PHEV
--     MHEV | MILD                   -> MHEV
--     E-POWER (Nissan)              -> REEV  (hibrido serie, no paralelo)
--     HEV | HIBRIDO | HYBRID        -> HEV
--     EV | BEV                      -> EV
--
-- Trampas evitadas a proposito: EVOQUE, EVOLUTION y EVO NO son 'EV'.
-- Los Range Rover Evoque que aparecen abajo entraron por su token PHEV
-- o MHEV, que si es correcto.
--
-- Impacto: 1.765 unidades salen de ICE (PHEV +502, HEV +477, MHEV +417,
-- REEV +252, EV +117). Revisar con el equipo comercial; para revertir
-- una, borrar su linea y volver a correr la ingesta.

INSERT OR REPLACE INTO correccion_modelo_tecnologia (marca, modelo, tecnologia, nota) VALUES
  ('BYD', 'BYD YUAN EV GS', 'EV', 'nombre indica EV; la fuente lo traia como ICE'),
  ('BYD', 'BYD YUAN PLUS EV', 'EV', 'nombre indica EV; la fuente lo traia como ICE'),
  ('BYD', 'BYD YUAN PRO EV GL', 'EV', 'nombre indica EV; la fuente lo traia como ICE'),
  ('BYD', 'BYD YUAN PRO EV GS', 'EV', 'nombre indica EV; la fuente lo traia como ICE'),
  ('BYD', 'SEAGULL EV', 'EV', 'nombre indica EV; la fuente lo traia como ICE'),
  ('BYD', 'SEALION 07 EV', 'EV', 'nombre indica EV; la fuente lo traia como ICE'),
  ('BYD', 'SONG L EV', 'EV', 'nombre indica EV; la fuente lo traia como ICE'),
  ('BYD', 'SONG PLUS DMI GS', 'PHEV', 'nombre indica PHEV; la fuente lo traia como ICE'),
  ('BYD', 'SONG PRO DMI', 'PHEV', 'nombre indica PHEV; la fuente lo traia como ICE/PHEV'),
  ('BYD', 'YUAN PLUS EV', 'EV', 'nombre indica EV; la fuente lo traia como ICE'),
  ('BYD', 'YUAN PLUS EV GS', 'EV', 'nombre indica EV; la fuente lo traia como ICE'),
  ('BYD', 'YUAN PLUS HONOR EV', 'EV', 'nombre indica EV; la fuente lo traia como ICE'),
  ('BYD', 'YUAN PRO DM-I GS', 'PHEV', 'nombre indica PHEV; la fuente lo traia como ICE'),
  ('CHERY', 'T4 PRO 1.5L A/T G HEV COMFORT 2WD', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('CHERY', 'T4 PRO 1.5L A/T G HEV LUXURY 2WD', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('CHERY', 'T7 PRO 1.5 T PREMIUM PHEV', 'PHEV', 'nombre indica PHEV; la fuente lo traia como ICE'),
  ('CHERY', 'T7 PRO 1.5L A/T G PHEV PREMIUM 2WD', 'PHEV', 'nombre indica PHEV; la fuente lo traia como ICE'),
  ('CHERY', 'T8 PRO 1.5L T A/T G PHEV (HIBRIDO) 2WD', 'PHEV', 'nombre indica PHEV; la fuente lo traia como ICE'),
  ('CHERY', 'T8 PRO 1.5T PHEV LUXURY', 'PHEV', 'nombre indica PHEV; la fuente lo traia como ICE'),
  ('CHERY', 'T8 PRO 1.5TCI PHEV', 'PHEV', 'nombre indica PHEV; la fuente lo traia como ICE'),
  ('CHEVROLET', 'CAPTIVA PREMIER EV AT', 'EV', 'nombre indica EV; la fuente lo traia como ICE'),
  ('CHEVROLET', 'SPARK EV AT', 'EV', 'nombre indica EV; la fuente lo traia como ICE'),
  ('FIAT', 'FASTBACK AUDACE 1.0 MHEV', 'MHEV', 'nombre indica MHEV; la fuente lo traia como ICE'),
  ('FIAT', 'FASTBACK IMPETUS 1.0 MHEV', 'MHEV', 'nombre indica MHEV; la fuente lo traia como ICE'),
  ('FIAT', 'PULSE IMPETUS 1.0 MHEV', 'MHEV', 'nombre indica MHEV; la fuente lo traia como ICE'),
  ('FIAT', 'PULSE IMPETUS 1.0L MHEV', 'MHEV', 'nombre indica MHEV; la fuente lo traia como ICE'),
  ('GAC', 'EMKOO GL 2.0 HEV AT', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('GAC', 'EMKOO HEV GE', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('GAC', 'GS8 2.0 TM 4WD GX HIBRIDO', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('GREAT WALL', 'H6 DELUXE PHEV 2WD', 'PHEV', 'nombre indica PHEV; la fuente lo traia como ICE'),
  ('GREAT WALL', 'H6 DELUXE PHEV 4WD', 'PHEV', 'nombre indica PHEV; la fuente lo traia como ICE'),
  ('GREAT WALL', 'H6 GT DELUXE PHEV', 'PHEV', 'nombre indica PHEV; la fuente lo traia como ICE'),
  ('GREAT WALL', 'H6 HEV DELUXE', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('GREAT WALL', 'HAVAL H6 DELUXE PHEV 4WD', 'PHEV', 'nombre indica PHEV; la fuente lo traia como ICE'),
  ('GREAT WALL', 'HAVAL H6 GT PHEV', 'PHEV', 'nombre indica PHEV; la fuente lo traia como ICE'),
  ('GREAT WALL', 'HAVAL H6 HEV DELUXE', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('GREAT WALL', 'HAVAL H6 HEV ELITE', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('GREAT WALL', 'HAVAL H6 PHEV DELUXE', 'PHEV', 'nombre indica PHEV; la fuente lo traia como ICE'),
  ('GREAT WALL', 'HAVAL JOLION HEV', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('GREAT WALL', 'HAVAL JOLION HEV DELUXE', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('GREAT WALL', 'HAVAL JOLION PRO HEV ELITE', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('GREAT WALL', 'HAVAL JOLION PRO HEV TOP', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('GREAT WALL', 'JOLION PRO HEV ELITE', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('GREAT WALL', 'TANK 300 HEV ELITE', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('GREAT WALL', 'TANK 500 PHEV', 'PHEV', 'nombre indica PHEV; la fuente lo traia como ICE'),
  ('HAVAL', 'HAVAL H6 HEV DELUXE', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('HAVAL', 'JOLION HEV', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('HONDA', 'CRV HYBRID CVT', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('HYUNDAI', 'IONIQ EV', 'EV', 'nombre indica EV; la fuente lo traia como ICE'),
  ('JAC', 'JS1 EV', 'EV', 'nombre indica EV; la fuente lo traia como ICE'),
  ('JAC', 'M3 EV', 'EV', 'nombre indica EV; la fuente lo traia como ICE'),
  ('JAC', 'REFINE RF8 PHEV', 'PHEV', 'nombre indica PHEV; la fuente lo traia como ICE'),
  ('JETOUR', 'G700 PHEV EXCLUSIVE', 'PHEV', 'nombre indica PHEV; la fuente lo traia como ICE'),
  ('JETOUR', 'G700 PHEV LUXURY', 'PHEV', 'nombre indica PHEV; la fuente lo traia como ICE'),
  ('LAND ROVER', 'DEFENDER 2.0L T/C PETROL PHEV', 'PHEV', 'nombre indica PHEV; la fuente lo traia como ICE'),
  ('LAND ROVER', 'DEFENDER 3.0L T C DIESEL MHEV', 'MHEV', 'nombre indica MHEV; la fuente lo traia como ICE'),
  ('LAND ROVER', 'DEFENDER 3.0L T C PETROL MHEV', 'MHEV', 'nombre indica MHEV; la fuente lo traia como ICE'),
  ('LAND ROVER', 'DISCOVERY 2.0L T C DIESEL MHEV AWD', 'MHEV', 'nombre indica MHEV; la fuente lo traia como ICE'),
  ('LAND ROVER', 'DISCOVERY 3.0L T C PETROL MHEV AWD', 'MHEV', 'nombre indica MHEV; la fuente lo traia como ICE'),
  ('LAND ROVER', 'DISCOVERY SPORT 1.5L T C PETROL PHEV', 'PHEV', 'nombre indica PHEV; la fuente lo traia como ICE'),
  ('LAND ROVER', 'DISCOVERY SPORT 2.0L T/C PETROL MHEV', 'MHEV', 'nombre indica MHEV; la fuente lo traia como ICE'),
  ('LAND ROVER', 'NEW RANGE ROVER SPORT 3.0L PETROL MHEV', 'MHEV', 'nombre indica MHEV; la fuente lo traia como ICE'),
  ('LAND ROVER', 'NEW RANGE ROVER SPORT 3.0L PETROL PHEV', 'PHEV', 'nombre indica PHEV; la fuente lo traia como ICE'),
  ('LAND ROVER', 'NEW RANGE ROVER SPORT 3.0L T C MHEV', 'MHEV', 'nombre indica MHEV; la fuente lo traia como ICE'),
  ('LAND ROVER', 'RANGE ROVER 3.0L T C DIESEL MHEV', 'MHEV', 'nombre indica MHEV; la fuente lo traia como ICE'),
  ('LAND ROVER', 'RANGE ROVER 3.0L T C DIESEL MHEV AWD', 'MHEV', 'nombre indica MHEV; la fuente lo traia como ICE'),
  ('LAND ROVER', 'RANGE ROVER 3.0L T C PETROL MHEV AWD', 'MHEV', 'nombre indica MHEV; la fuente lo traia como ICE'),
  ('LAND ROVER', 'RANGE ROVER 3.0L T C PETROL PHEV', 'PHEV', 'nombre indica PHEV; la fuente lo traia como ICE'),
  ('LAND ROVER', 'RANGE ROVER EVOQUE 1.5L T C PETROL PHEV', 'PHEV', 'nombre indica PHEV; la fuente lo traia como ICE'),
  ('LAND ROVER', 'RANGE ROVER EVOQUE 2.0L T C DIESEL MHEV', 'MHEV', 'nombre indica MHEV; la fuente lo traia como ICE'),
  ('LAND ROVER', 'RANGE ROVER EVOQUE 2.0L T C PETROL MHEV', 'MHEV', 'nombre indica MHEV; la fuente lo traia como ICE'),
  ('LAND ROVER', 'RANGE ROVER SPORT 3.0L T C PETROL MHEV', 'MHEV', 'nombre indica MHEV; la fuente lo traia como ICE'),
  ('LAND ROVER', 'RANGE ROVER SPORT 3.0L T C PETROL PHEV', 'PHEV', 'nombre indica PHEV; la fuente lo traia como ICE'),
  ('LAND ROVER', 'RANGE ROVER SPORT 3.0L T/C DIESEL MHEV', 'MHEV', 'nombre indica MHEV; la fuente lo traia como ICE'),
  ('LAND ROVER', 'RANGE ROVER VELAR 2.0L T C PETROL PHEV', 'PHEV', 'nombre indica PHEV; la fuente lo traia como ICE'),
  ('LAND ROVER', 'RANGE ROVER VELAR 3.0L T C PETROL MHEV', 'MHEV', 'nombre indica MHEV; la fuente lo traia como ICE'),
  ('MASERATI', 'GHIBLI MILD HYBRID GRANLUSSO', 'MHEV', 'nombre indica MHEV; la fuente lo traia como ICE'),
  ('MASERATI', 'GRECALE GT HYBRID SPORT', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('MASERATI', 'GRECALE MODENA HYBRID', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('MASERATI', 'LEVANTE GT HYBRID', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('MASERATI', 'LEVANTE GT HYBRID SPORT', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('MASERATI', 'LEVANTE GT HYBRID ULTIMA', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('MAXUS', 'T90 EV 4X2', 'EV', 'nombre indica EV; la fuente lo traia como ICE'),
  ('MAZDA', 'CX-60 MHEV', 'MHEV', 'nombre indica MHEV; la fuente lo traia como ICE'),
  ('MAZDA', 'CX-90 MHEV', 'MHEV', 'nombre indica MHEV; la fuente lo traia como ICE'),
  ('MAZDA', 'CX90 MILD HYBRID', 'MHEV', 'nombre indica MHEV; la fuente lo traia como ICE'),
  ('MERCEDES BENZ', 'AMG GLE 53 HYBRID 4MATIC+ COUPE', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('NISSAN', 'XTRAIL EPOWER', 'REEV', 'nombre indica REEV; la fuente lo traia como ICE/REEV'),
  ('PEUGEOT', '208 MCA GT 1.0 T 125 CVT FLEX BIO HYBRID', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('PORSCHE', 'CAYENNE E-HYBRID COUPE BLACK EDITION', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('PORSCHE', 'CAYENNE S E HYBRID COUPE', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('PORSCHE', 'CAYENNE S E-HYBRID', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('PORSCHE', 'CAYENNE S E-HYBRID BLACK EDITION', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('PORSCHE', 'CAYENNE S E-HYBRID COUPE BLACK EDITION', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('PORSCHE', 'MACAN 4S BEV', 'EV', 'nombre indica EV; la fuente lo traia como ICE'),
  ('PORSCHE', 'PANAMERA 4 E HYBRID', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('RADAR', 'HORIZON EV 2026 PILOT', 'EV', 'nombre indica EV; la fuente lo traia como ICE'),
  ('RENAULT', 'ARKANA ETECH HYBRID', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('SOUEAST', 'S06 1.5 6DCT V5 PHEV', 'PHEV', 'nombre indica PHEV; la fuente lo traia como ICE'),
  ('SOUEAST', 'S06 PHEV III GL', 'PHEV', 'nombre indica PHEV; la fuente lo traia como ICE'),
  ('SOUEAST', 'S06 PHEV V GLS', 'PHEV', 'nombre indica PHEV; la fuente lo traia como ICE'),
  ('SOUEAST', 'S08 1.5 PHEV GLS', 'PHEV', 'nombre indica PHEV; la fuente lo traia como ICE'),
  ('SUBARU', 'CROSSTREK 2.0I-S ES CVT MHEV', 'MHEV', 'nombre indica MHEV; la fuente lo traia como ICE'),
  ('SUBARU', 'CROSSTREK 2.0IS ES CVT HEV', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('SUBARU', 'CROSSTREK 2.0IS ES HEV CVT', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('SUBARU', 'FORESTER 2.0IL ES HEV CVT', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('SUBARU', 'FORESTER 2.0IS ES HEV CVT', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('SUBARU', 'XV HEV 2.0IS ES', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('SUBARU', 'XV HEV 2.0IS ES CVT', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('TOYOTA', '4-RUNNER HYBRID TRD OFF ROAD PREMIUN 4X4 AT', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('TOYOTA', '4RUNNER I-FORCE HYBRID LIMITED', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('TOYOTA', '4RUNNER PLATINUM HIBRIDO', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('TOYOTA', 'CHR HIBRIDO', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('TOYOTA', 'COROLLA 1.8L HYBRID', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('TOYOTA', 'COROLLA CROSS 2.0L HYBRID', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('TOYOTA', 'COROLLA CROSS HIBRIDO AUT', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('TOYOTA', 'COROLLA HIBRIDO', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('TOYOTA', 'LAND CRUISER 300 HIBRIDO', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('TOYOTA', 'LAND CRUISER 300 VXR/HEV', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('TOYOTA', 'LAND CRUISER PRADO HIBRIDO', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('TOYOTA', 'LAND CRUISER PRADO HYBRID', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('TOYOTA', 'RAV4 HYBRID', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('TOYOTA', 'TACOMA TRD 2026 HIBRIDO', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('TOYOTA', 'TUNDRA LIMITED HYBRID', 'HEV', 'nombre indica HEV; la fuente lo traia como ICE'),
  ('VOYAH DREAMER', 'EV MAX GROUND CLEARENCE', 'EV', 'nombre indica EV; la fuente lo traia como ICE');

-- Para agregar una correccion nueva, sumar una linea al INSERT de arriba:
--   ('MARCA', 'MODELO EXACTO', 'PHEV', 'por que');
-- El modelo tiene que estar escrito como queda DESPUES de la unificacion
-- de grafias (ver seccion anterior). Consultarlo con:
--   SELECT DISTINCT marca, modelo FROM v_matriculacion WHERE marca='BYD';

