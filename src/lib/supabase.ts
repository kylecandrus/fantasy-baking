import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;
let _configured = false;

const STUB_RESULT = { data: null, error: { message: 'Supabase not configured' } };

function createStub(): any {
  const result = Promise.resolve(STUB_RESULT);
  const handler: ProxyHandler<any> = {
    get(_t, prop) {
      if (prop === 'then') return (resolve: any) => result.then(resolve);
      if (prop === 'catch') return (reject: any) => result.catch(reject);
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
    return (_supabase as any)[prop];
  },
});
