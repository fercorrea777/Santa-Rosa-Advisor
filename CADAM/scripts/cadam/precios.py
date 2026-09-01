"""Lectura de importes de una lista de precios en Excel/CSV.

Puro: entra lo que trae la celda, sale un numero. Portado de
`COTIZADOR SRPY/src/lib/precios.js`, que resolvio este problema contra los
Excel reales de Santa Rosa despues de que costara caro.

El separador decimal NO se puede asumir: el mismo dato viene escrito de las
dos formas segun quien exporto el archivo.

    "  1004545.45"  <- export de sistema: punto DECIMAL
    "15.500"        <- escrito a mano en guaranies: punto de MILES

Barrer todo lo que no sea digito (`re.sub(r'[^\\d-]', '', s)`) trata las dos
como separador de miles, y con el formato de export eso multiplica por 100:
"86363.63" queda en 8.636.363. En el Cotizador eso llego a produccion con
1784 filas mal el 21/08/2026.

La regla que desambigua: decide el ULTIMO separador, por cuantos digitos lo
siguen. Uno o dos -> decimal ("395.46", "1.5"). Tres -> miles ("15.500"),
porque nadie escribe tres decimales en un precio. Los separadores anteriores
son siempre de miles ("1.004.545,45").

Tres digitos es genuinamente ambiguo: "15.500" podria ser quince mil
quinientos o quince coma quinientos. Se resuelve a favor de miles porque en
guaranies no se usan centavos -- la moneda no tiene subdivision en
circulacion -- asi que un precio con decimales solo aparece cuando lo calculo
un sistema, y esos vienen con dos, no con tres.
"""
import re


def parse_money(valor) -> float:
    """Devuelve el importe de una celda. 0.0 si no se puede leer."""
    # Si el lector ya lo entrego como numero (celda numerica de verdad, sin
    # formato de texto), no hay separadores que interpretar: es el valor.
    if isinstance(valor, (int, float)) and not isinstance(valor, bool):
        return float(valor) if valor == valor else 0.0  # NaN != NaN

    texto = str(valor or "").strip()
    if not texto:
        return 0.0

    negativo = "-" in texto
    limpio = re.sub(r"[^\d.,]", "", texto)
    if not limpio:
        return 0.0

    corte = max(limpio.rfind("."), limpio.rfind(","))
    cola = "" if corte == -1 else limpio[corte + 1:]
    es_decimal = len(cola) in (1, 2)

    entero = (limpio[:corte] if es_decimal else limpio).replace(".", "").replace(",", "")
    try:
        numero = float(f"{entero or '0'}{'.' + cola if es_decimal else ''}")
    except ValueError:
        return 0.0

    return -numero if negativo else numero
