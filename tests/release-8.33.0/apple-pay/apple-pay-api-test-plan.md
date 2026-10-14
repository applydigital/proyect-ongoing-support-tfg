# Apple Pay — plan para un test a nivel API (sin dispositivo Apple)

## Por qué no escribí el test todavía

Pensé en un test de Playwright que llame directo al endpoint que autoriza el pago
(lo que Daniela llama `authorizeOrderPayment`), con datos de facturación incompletos
(`familyName` vacío), para ver si el servidor lo rechaza bien sin necesitar la hoja
nativa de Apple. Es justo el tipo de test que habría atrapado el incidente de
TFGTRS-4577 antes de que llegara a producción.

No lo escribí porque no tengo dos datos imprescindibles, y adivinarlos daría un test
que parece funcionar pero no prueba nada real:

1. **La URL exacta del endpoint.** Este repo solo tiene los tests de Playwright; el
   código del cartridge de Adyen (`int_adyen_overlay`, el que tiene el bug en
   `adyenHelper.js:539` según TFGTRS-4577) no está acá. Conozco los nombres de los
   controladores estándar de SFRA que aparecen en los logs del incidente
   (`CheckoutServices-PlaceOrder`, `CheckoutServices-SubmitPayment`), pero no sé si
   Apple Pay usa esos mismos o un endpoint propio (algo tipo `Adyen-AuthorizePayment`
   o similar).
2. **La forma del payload.** La petición que arma el JS de Apple Pay en el navegador
   (los datos del `ApplePayPaymentToken`, el contacto de envío/facturación, el
   `csrf_token`, etc.) tiene un formato específico. Sin haber visto una petición real
   no puedo reproducirla a mano sin inventar campos.

## Qué necesito para armarlo

Pedirle al dev que hizo el fix de TFGTRS-4577:

- Un HAR o las capturas de Network de una petición real de Apple Pay contra staging
  o dev (puede ser una que haya fallado, como el pedido 19594868), con los datos
  sensibles de la tarjeta ya sacados — solo necesito la URL, el método y la forma del
  body.
- Confirmación de si la validación de `familyName`/dirección pasa por el mismo
  endpoint que arregló TFGTRS-4577, o por otro.

## Con eso armo

Un test de Playwright que use `request.post()` (API testing, sin browser) contra ese
endpoint, repitiendo el payload real pero con `familyName` vacío, código postal sin
espacio, etc. — los mismos casos del checklist manual
(`apple-pay-manual-checklist.md`), pero corriendo en CI sin depender de un
dispositivo Apple ni de BrowserStack. Esto cubre el tramo que el e2e de navegador no
puede: todo lo que pasa después del click, del lado servidor.

## Lo que este test NO reemplaza

La hoja nativa de Apple Pay, la autenticación (Face ID/Touch ID) y la generación real
del token de pago siguen sin poder probarse sin un dispositivo Apple o BrowserStack.
Ese tramo queda cubierto por `apple-pay-manual-checklist.md`.
