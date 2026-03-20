// ============================================================
// DADOS DOS PRODUTOS — Império do Burgão
// ============================================================
const BEBIDAS_DISPONIVEIS = [
    { id: 'coca-cola', nome: 'Coca-Cola', imagem: 'images/bebidas/cocacola.webp' },
    { id: 'guarana-antartica', nome: 'Guaraná Antartica', imagem: 'images/bebidas/guarana.webp' },
    { id: 'fanta-laranja', nome: 'Fanta Laranja', imagem: 'images/bebidas/fantalaranja.webp' },
    { id: 'guarana-zero', nome: 'Guaraná Antartica Zero', imagem: 'images/bebidas/guaranazero.webp' },
    { id: 'pepsi', nome: 'Pepsi', imagem: 'images/bebidas/pepsi.webp' },
    { id: 'coca-zero', nome: 'Coca-Cola Zero', imagem: 'images/bebidas/cocacolazero.webp' },
];

const MAX_BEBIDAS = 2;

const PRODUTOS = [
    // ===================== COMBOS BURGÃO =====================
    {
        id: 1,
        nome: 'Combo Casal - 2 Burgões + Batata Especial 500g',
        descricao: '2 Burgues da Casa + Batata com cheddar e bacon 500g + 2 Refrigerantes 350 ml',
        preco: 3290, // centavos
        precoOriginal: 5380,
        imagem: 'images/1.webp',
        categoria: 'Combos Burgão',
        maxBebidas: 2,
    },
    {
        id: 2,
        nome: 'Combo Família: 4 Burgões + 2 porções de Batata Especial 500g',
        descricao: '4 Burgues da Casa + 2 Batatas com cheddar e bacon 500g + 4 Refrigerantes 350 ml',
        preco: 4990,
        precoOriginal: 7580,
        imagem: 'images/2.webp',
        categoria: 'Combos Burgão',
        maxBebidas: 2,
    },
    {
        id: 3,
        nome: 'Burgão, Batata Frita 250g e Refrigerante 350ml',
        descricao: '1 Burgão da Casa + Batata Frita 250g + 1 Refrigerante 350 ml',
        preco: 1990,
        precoOriginal: 3980,
        imagem: 'images/3.webp',
        categoria: 'Combos Burgão',
        maxBebidas: 2,
    },
    // ================ LANCHES INDIVIDUAIS ================
    {
        id: 4,
        nome: 'Burgão Especial',
        descricao: 'Hambúrguer artesanal especial da casa',
        preco: 1590,
        precoOriginal: 3990,
        imagem: 'images/4.webp',
        categoria: 'Lanches individuais',
        maxBebidas: 2,
    },
    {
        id: 5,
        nome: 'Burgão Duplo',
        descricao: 'Hambúrguer artesanal duplo',
        preco: 1590,
        precoOriginal: 3990,
        imagem: 'images/5.webp',
        categoria: 'Lanches individuais',
        maxBebidas: 2,
    },
    {
        id: 6,
        nome: 'Burgão Triplo',
        descricao: 'Hambúrguer artesanal triplo',
        preco: 2789,
        precoOriginal: 3790,
        imagem: 'images/6.webp',
        categoria: 'Lanches individuais',
        maxBebidas: 2,
    },
    {
        id: 7,
        nome: 'Burgão salada',
        descricao: 'Hambúrguer artesanal com salada fresca',
        preco: 1700,
        precoOriginal: null,
        imagem: 'images/7.webp',
        categoria: 'Lanches individuais',
        maxBebidas: 2,
    },
    {
        id: 8,
        nome: 'Burgão Caramelizado',
        descricao: 'Hambúrguer artesanal com cebola caramelizada',
        preco: 2000,
        precoOriginal: 2700,
        imagem: 'images/8.webp',
        categoria: 'Lanches individuais',
        maxBebidas: 2,
    },
    {
        id: 9,
        nome: 'Burguer cheddar bacon',
        descricao: 'Hambúrguer artesanal com cheddar e bacon',
        preco: 1900,
        precoOriginal: 2600,
        imagem: 'images/9.webp',
        categoria: 'Lanches individuais',
        maxBebidas: 2,
    },
    {
        id: 10,
        nome: 'Duplo cheddar - hambúrguer',
        descricao: 'Hambúrguer artesanal duplo com cheddar',
        preco: 2400,
        precoOriginal: 3000,
        imagem: 'images/10.webp',
        categoria: 'Lanches individuais',
        maxBebidas: 2,
    },
];

// URL de redirecionamento após pagamento confirmado
const REDIRECT_AFTER_PAYMENT = 'https://t.me/+ouigg2kSrds5NWQ5';

// Ofertas extras exibidas no checkout
const OFERTAS_CHECKOUT = [
    { id: 'coca-2l', nome: 'Coca Cola 2L', preco: 1400, imagem: 'images/bebidas/coca2L.webp' },
    { id: 'guarana-2l', nome: 'Guarana 2L', preco: 1200, imagem: 'images/bebidas/guarana2L.png' },
];

// ============================================================
// SISTEMA DE CARRINHO (localStorage)
// ============================================================
const CART = {
    KEY: 'imperio_cart',

    getItems() {
        try {
            return JSON.parse(localStorage.getItem(this.KEY)) || [];
        } catch { return []; }
    },

    saveItems(items) {
        localStorage.setItem(this.KEY, JSON.stringify(items));
    },

    addItem(product, qty, drinks, obs) {
        const items = this.getItems();
        // Verifica se o produto já existe no carrinho
        const existing = items.find(i => i.productId === product.id);
        if (existing) {
            existing.qty += qty;
            existing.drinks = drinks;
            existing.obs = obs;
        } else {
            items.push({
                productId: product.id,
                nome: product.nome,
                preco: product.preco,
                imagem: product.imagem,
                qty: qty,
                drinks: drinks,
                obs: obs,
            });
        }
        this.saveItems(items);
    },

    updateQty(productId, newQty) {
        let items = this.getItems();
        if (newQty <= 0) {
            items = items.filter(i => i.productId !== productId);
        } else {
            const item = items.find(i => i.productId === productId);
            if (item) item.qty = newQty;
        }
        this.saveItems(items);
    },

    removeItem(productId) {
        const items = this.getItems().filter(i => i.productId !== productId);
        this.saveItems(items);
    },

    clear() {
        localStorage.removeItem(this.KEY);
    },

    getTotal() {
        return this.getItems().reduce((sum, item) => sum + (item.preco * item.qty), 0);
    },

    getItemCount() {
        return this.getItems().reduce((sum, item) => sum + item.qty, 0);
    }
};

// Helper global: formatar preço
function formatPriceBRL(cents) {
    return 'R$ ' + (cents / 100).toFixed(2).replace('.', ',');
}
