# Release 8.34.0 — Seguimiento de tickets

Objetivo: tener en un solo lugar los tickets del release, sus casos de prueba para Testmo y el
estado de cada uno en dev, para re-verificarlos en staging cuando se congele el release candidate.

Se van a sumar más tickets: agregar una fila en la tabla y un CSV en `testmo/`, y volver a generar
el CSV combinado.

Estados: **Passed** · **Parcial** · **Bloqueado** · **Pendiente**

## Tickets del release

| Ticket | Marca | Título | Estado en dev | Casos Testmo | Evidencia |
|---|---|---|---|---|---|
| TFGTRS-4609 | Todas | Error InvalidStateError (responseText) en consola tras aceptar cookies | Passed en Chrome (emulación). Safari real y recorrido completo en Whistles sin cubrir | 4 | `TFGTRS-4609/` |
| TFGTRS-4352 | Hobbs · Phase Eight · Whistles | Hreflang / canonical | Re-testeado en dev | 6 | `TFGTRS-4352/` |
| TFGTRS-4447 | Phase Eight | Constructor devuelve 400 / alertas en logs | Pendiente: verificar logs y Grafana tras el deploy en staging o prod | 4 | `TFGTRS-4447/` |
| TFGTRS-4291 | Todas | Página de búsqueda sin resultados: alineación | Re-testeado en dev | 6 | `TFGTRS-4291/` |
| TFGTRS-4567 | Phase Eight | Tallas por color en producto multicolor (Donna) | Re-testeado en dev | 6 | `TFGTRS-4567/` |
| TFGTRS-4598 | Phase Eight | PLP: producto sin stock en SFCC pero listado por Constructor | Parcial: Occasion Scarf sigue en la búsqueda, ficha agotada sin romperse. No confirmado en el listado de Accesorios | 6 | `TFGTRS-4598/` |
| TFGTRS-4602 | Hobbs · Phase Eight · Whistles | Galería de la PDP móvil no hace loop | Hobbs y Phase Eight Passed. Whistles: loop hacia adelante corregido (MR !2515); hacia atrás desde la primera foto salta a una foto intermedia | 6 | `TFGTRS-4602/` |
| TFGTRS-4303 | Hobbs · Phase Eight · Whistles · Inside Story · Damsel in a Dress | XSS almacenado en el campo título del perfil | Passed en 4 marcas con limitaciones. Pendientes: Damsel in a Dress, datos ya guardados, limpieza en producción | 12 | `TFGTRS-4303/` |
| TFGTRS-4604 | Hobbs · Phase Eight | Badges automáticos £ / % para productos a precio completo en PLP | Dev confirmó que solo afecta a Hobbs y Phase Eight. Regresión de las insignias de rebaja (Sale) verificada en dev, sin cambios. Resto bloqueado: faltan nombres de preferencias, pricebooks y promociones de prueba | 11 | `TFGTRS-4604/` |
| TFGTRS-4592 | Hobbs · Phase Eight · Whistles | Fallos de checkout Adyen | Parcial: Hobbs OK en pantalla. Phase Eight no se pudo automatizar (la talla no se registra en dev). Logs de BM sin verificar | 6 | `TFGTRS-4592/` |
| TFGTRS-4338 | Hobbs | PDP sin stock (Notify me): optimización fase 2 | Retest en dev: sticky móvil y de escritorio, avisos de talla y botón deshabilitado corregidos. Abiertos (confirmados por dev, arreglo en código): panel de email desbordado en móvil y mensaje de email inválido. Falta verificar el salto de altura del panel | 7 | `TFGTRS-4338/` |

Los CSV están en `testmo/` (uno por ticket) y `testmo/RELEASE-8.34.0_all_testcases.csv` junta
todos (74 casos). Cada ticket tiene su carpeta (`TFGTRS-XXXX/`) con un README y, en local, sus capturas. Las capturas no se suben al repositorio.

## Pendientes y avisos

- **4598:** dejar el stock como estaba. Variante `100160810200` del Occasion Scarf en `inventory-P8-uk`: allocation 104, perpetual desmarcado.
- **4602:** pegar el comentario sobre Whistles y avisar al dev de la galería hacia atrás.
- **4303:** confirmar con dev si cubrió `Account-SaveDetails` (Whistles) además de `Account-SaveProfile`; la limpieza de producción la lanza un desarrollador desde BM, una vez por marca.
- **4604:** solo Hobbs y Phase Eight (confirmado por dev). Insignias de rebaja revisadas en dev sin cambios (`TFGTRS-4604/Hobbs-sale-plp.png`, `Phase-Eight-sale-plp.png`). Falta: entorno del fix, nombres de preferencias y pricebooks para armar un producto de precio completo en promoción, y una promoción de prueba (% y £) en dev.
- **4592:** probar a mano Phase Eight, Whistles y PayPal, y revisar `custom-Adyen_error`, `_warn` e `_info` en BM.
- **4338:** esperar el arreglo del dev (panel de email desbordado en móvil; botón deshabilitado solo con el campo vacío para que salga "Please enter a valid E-Mail address") y repetir el punto 7. Producto de prueba: Pink Pemberton Dress (`0126-5531-1185L00-BLUSH-PINK`). No usar la Petite Tia: no muestra tallas en dev.
- **4447:** comprobar que no aparezca el error de Constructor en logs tras el deploy.
- **4609:** cubrir Safari en un dispositivo real.
