/**
 * Datos compartidos para los flujos de checkout en los tests e2e cross-site.
 *
 * - El email se usa como guest en todos los sitios.
 * - La tarjeta de Adyen es SOLO para staging (tarjeta de test pública).
 * - En producción el test para antes de confirmar el pago.
 */

export const guestEmail = 'alma.gil@applydigital.com';

export const shippingAddress = {
  firstName: 'Test',
  lastName: 'User',
  phone: '07700900000',
  address1: '1 Oxford Street',
  address2: '',
  city: 'London',
  postcode: 'W1D 1BS',
  country: 'United Kingdom',
};

/** Tarjeta de test Adyen — solo válida en staging. */
export const adyenTestCard = {
  number: '4111 1111 1111 1111',
  expiry: '03/30',
  cvv: '737',
};
