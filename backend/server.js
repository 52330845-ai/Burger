import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';

const app = express();
app.use(cors());
app.use(express.json());

// for sql connection
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '', 
  database: 'food_app',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// he kermel test l database
async function testDBConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully');
    connection.release();
  } catch (error) {
    console.error('❌ Database connection failed');
    console.error(error.message);
    process.exit(1);
  }
}

// he kermel tchouf iza l user 3ndo cart iza eh ta tzid 3laya w iza la2 ta ta3melo wahde jdide
async function getDefaultCartId() {
  const [rows] = await pool.query('SELECT id FROM carts WHERE user_id = 1 LIMIT 1');
  if (rows.length) return rows[0].id;

  const [result] = await pool.query('INSERT INTO carts (user_id) VALUES (1)');
  return result.insertId;
}

// routes kermel l connection
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Food App API running' });
});

//  he part l Products
app.get('/api/products', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, description, price, image_url FROM products WHERE is_active = 1');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

//  part l Cart
app.get('/api/cart', async (req, res) => {
  try {
    const cartId = await getDefaultCartId();

    const [items] = await pool.query(`
      SELECT ci.id, ci.product_id, p.name, p.price, p.image_url, ci.quantity,
             (p.price * ci.quantity) AS line_total
      FROM cart_items ci
      JOIN products p ON p.id = ci.product_id
      WHERE ci.cart_id = ?`,
      [cartId]
    );

    const total = items.reduce((sum, i) => sum + Number(i.line_total), 0);
    res.json({ cartId, items, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

// Add to cart
app.post('/api/cart/add', async (req, res) => {
  try {
    const cartId = await getDefaultCartId();
    const { productId, quantity } = req.body;

    if (!productId || !quantity) return res.status(400).json({ error: 'productId and quantity are required' });

    // Check if item exists
    const [rows] = await pool.query('SELECT id, quantity FROM cart_items WHERE cart_id=? AND product_id=?', [cartId, productId]);

    if (rows.length) {
      const newQty = rows[0].quantity + quantity;
      await pool.query('UPDATE cart_items SET quantity=? WHERE id=?', [newQty, rows[0].id]);
    } else {
      await pool.query('INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?,?,?)', [cartId, productId, quantity]);
    }

    res.json({ message: 'Item added to cart' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add to cart' });
  }
});
const PORT = 4000;
app.listen(PORT, async () => {
  console.log("🚀 Server running on port ${PORT}");
  await testDBConnection();
});