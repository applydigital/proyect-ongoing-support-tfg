# Apple Pay — checklist manual (staging, dispositivo Apple / BrowserStack)

Contexto: Playwright no puede completar un pago con Apple Pay (ver
`tests/release-8.33.0/RELEASE-8.33.0.md` y el incidente TFGTRS-4577). Este checklist
es para correr a mano en Safari real (Mac/iPhone o BrowserStack) sobre staging antes
de cada release que toque checkout o el cartridge de Adyen.

Requisitos antes de empezar:
- Dispositivo Apple (o sesión de BrowserStack) con una tarjeta de test en Wallet / cuenta
  sandbox de Apple Pay.
- Acceso a Log Center / Grafana para confirmar que no aparecen errores de `authorizeOrderPayment`
  ni del endpoint que termine usando Apple Pay, durante y después de cada caso.
- Marcas a cubrir: Hobbs y Phase Eight (Whistles ya tiene el fix de título vacío aplicado
  según TFGTRS-4577; igual conviene correr el caso 1 ahí también).

## Casos

| # | Caso | Pasos | Resultado esperado |
|---|---|---|---|
| 1 | Flujo feliz — carrito | Agregar producto, ir a `/cart`, pagar con Apple Pay con una dirección y contacto completos | La hoja de Apple Pay se abre, el pago se autoriza, se llega a la confirmación del pedido |
| 2 | Flujo feliz — checkout (Whistles) | Iniciar el express checkout de Apple Pay desde la página de checkout (no desde el carrito), con una canasta sin dirección de envío todavía | El pedido se autoriza (antes fallaba con "invalid shipping address") |
| 3 | `familyName` vacío | Usar un contacto de Wallet sin apellido (solo nombre) | El pedido se autoriza, toma el apellido del contacto de facturación (antes fallaba: "Billing: Please enter a value in familyname") |
| 4 | Código postal sin espacio | Contacto de Wallet con código postal tipo `E34HH` (sin espacio) o en minúsculas | El pedido se autoriza; el código se normaliza (ej. `E3 4HH`) |
| 5 | Nombre con tilde o apóstrofo | Contacto "José Núñez" y otro "O'Brien" | El pedido se autoriza; los acentos se normalizan (p. ej. "Jose Nunez"), el apóstrofo se conserva |
| 6 | Caracteres sin equivalente latino | Contacto con nombre en otro alfabeto (ej. cirílico) | El pedido se rechaza con un mensaje entendible (comportamiento esperado, no es bug) |
| 7 | Contacto de envío sin apellido | Wallet con contacto de envío incompleto (sin surname) | Toma el apellido del contacto de facturación; el pedido se autoriza |
| 8 | Campo de facturación ausente | Wallet que no entrega un campo obligatorio de facturación | Aparece el mensaje de Apple Pay correspondiente, no una excepción interna |

## Al terminar cada caso

- Capturar pantalla de la hoja de Apple Pay y de la confirmación (o del error).
- Anotar el número de pedido generado (o el motivo del rechazo).
- Revisar Log Center/Grafana por errores nuevos en la ventana de la prueba.
- Si algo falla de forma inesperada, guardar el payload de red si es posible (ver
  `apple-pay-api-test-plan.md` en esta misma carpeta: esos HAR sirven para el test de API).
