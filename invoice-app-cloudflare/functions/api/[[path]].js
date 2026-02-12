// Cloudflare Workers - API Backend
// This file handles authentication and database operations

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Route handling
    if (url.pathname === '/api/register') {
      return handleRegister(request, env, corsHeaders);
    }
    
    if (url.pathname === '/api/login') {
      return handleLogin(request, env, corsHeaders);
    }
    
    if (url.pathname === '/api/invoices') {
      return handleInvoices(request, env, corsHeaders);
    }
    
    if (url.pathname.startsWith('/api/invoices/')) {
      return handleInvoiceById(request, env, corsHeaders);
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};

// User Registration
async function handleRegister(request, env, corsHeaders) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const { email, password, company } = await request.json();
    
    // Validate input
    if (!email || !password || !company) {
      return new Response(JSON.stringify({ error: '必須項目が不足しています' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if user already exists
    const existingUser = await env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email).first();

    if (existingUser) {
      return new Response(JSON.stringify({ error: 'このメールアドレスは既に登録されています' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Hash password (in production, use proper hashing like bcrypt)
    const userId = crypto.randomUUID();
    const hashedPassword = await hashPassword(password);

    // Insert user
    await env.DB.prepare(
      'INSERT INTO users (id, email, password, company, created_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(userId, email, hashedPassword, company, new Date().toISOString()).run();

    // Create session token
    const token = crypto.randomUUID();
    await env.DB.prepare(
      'INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)'
    ).bind(token, userId, new Date().toISOString()).run();

    return new Response(JSON.stringify({ 
      success: true, 
      token,
      user: { id: userId, email, company }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// User Login
async function handleLogin(request, env, corsHeaders) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const { email, password } = await request.json();

    // Get user
    const user = await env.DB.prepare(
      'SELECT id, email, password, company FROM users WHERE email = ?'
    ).bind(email).first();

    if (!user) {
      return new Response(JSON.stringify({ error: 'メールアドレスまたはパスワードが正しくありません' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return new Response(JSON.stringify({ error: 'メールアドレスまたはパスワードが正しくありません' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create session token
    const token = crypto.randomUUID();
    await env.DB.prepare(
      'INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)'
    ).bind(token, user.id, new Date().toISOString()).run();

    return new Response(JSON.stringify({ 
      success: true, 
      token,
      user: { id: user.id, email: user.email, company: user.company }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Get all invoices for authenticated user
async function handleInvoices(request, env, corsHeaders) {
  const userId = await authenticateRequest(request, env);
  if (!userId) {
    return new Response(JSON.stringify({ error: '認証が必要です' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (request.method === 'GET') {
    // Get all invoices for user
    const invoices = await env.DB.prepare(
      'SELECT * FROM invoices WHERE user_id = ? ORDER BY created_at DESC'
    ).bind(userId).all();

    return new Response(JSON.stringify({ invoices: invoices.results }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (request.method === 'POST') {
    // Create new invoice
    const data = await request.json();
    const invoiceId = crypto.randomUUID();

    await env.DB.prepare(
      'INSERT INTO invoices (id, user_id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(
      invoiceId, 
      userId, 
      JSON.stringify(data), 
      new Date().toISOString(),
      new Date().toISOString()
    ).run();

    return new Response(JSON.stringify({ success: true, id: invoiceId }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response('Method not allowed', { status: 405, headers: corsHeaders });
}

// Get/Update/Delete specific invoice
async function handleInvoiceById(request, env, corsHeaders) {
  const userId = await authenticateRequest(request, env);
  if (!userId) {
    return new Response(JSON.stringify({ error: '認証が必要です' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const url = new URL(request.url);
  const invoiceId = url.pathname.split('/').pop();

  if (request.method === 'GET') {
    const invoice = await env.DB.prepare(
      'SELECT * FROM invoices WHERE id = ? AND user_id = ?'
    ).bind(invoiceId, userId).first();

    if (!invoice) {
      return new Response(JSON.stringify({ error: '請求書が見つかりません' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ invoice }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (request.method === 'PUT') {
    const data = await request.json();
    
    await env.DB.prepare(
      'UPDATE invoices SET data = ?, updated_at = ? WHERE id = ? AND user_id = ?'
    ).bind(JSON.stringify(data), new Date().toISOString(), invoiceId, userId).run();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (request.method === 'DELETE') {
    await env.DB.prepare(
      'DELETE FROM invoices WHERE id = ? AND user_id = ?'
    ).bind(invoiceId, userId).run();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response('Method not allowed', { status: 405, headers: corsHeaders });
}

// Helper: Authenticate request
async function authenticateRequest(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const session = await env.DB.prepare(
    'SELECT user_id FROM sessions WHERE token = ?'
  ).bind(token).first();

  return session ? session.user_id : null;
}

// Helper: Hash password (simplified - use proper library in production)
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Helper: Verify password
async function verifyPassword(password, hash) {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}
