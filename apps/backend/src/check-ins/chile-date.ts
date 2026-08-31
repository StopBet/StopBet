// El helper se movió a `common/chile-date.ts` porque el mismo desfase afectaba a
// la racha de días (`users`, `achievements`) y a las cuotas (`billing`), no solo
// al check-in. Se re-exporta acá para no tocar los imports existentes.
export { todayInChile, daysAgoInChile } from '../common/chile-date';
