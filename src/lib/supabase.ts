import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;
let _configured = false;

const STUB_RESULT = { data: null, error: { message: 'Supabase not configured' } };

// This stub mimics the shape of a chained Supabase query builder (whose real
// type is deeply generic and impractical to replicate here) so that calling
// code can keep chaining `.from().select().eq()...` and always land on the
// same resolved stub result when env vars are missing. `any` is intentional.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createStub(): any {
  const result = Promise.resolve(STUB_RESULT);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handler: ProxyHandler<any> = {
    get(_t, prop) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (prop === 'then') return (resolve: any) => result.then(resolve);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (prop === 'catch') return (reject: any) => result.catch(reject);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (prop === 'finally') return (cb: any) => result.finally(cb);
      return createStub();
    },
    apply() { return createStub(); },
  };
  return new Proxy(function () { return createStub(); }, handler);
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_configured) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
      if (url.startsWith('http')) {
        _supabase = createClient(url, key);
        _configured = true;
      } else {
        return createStub();
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (_supabase as any)[prop];
  },
});
