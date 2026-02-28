function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

function toProductResponse(product, options = {}) {
  if (!product) return null;
  const obj = product.toObject ? product.toObject() : { ...product };

  const variants = Array.isArray(obj.variants) ? obj.variants : [];
  const derivedSizes = variants
    .map((v) => v && v.size)
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i);
  const derivedColors = variants
    .map((v) => v && v.color)
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i);

  const sizes = normalizeArray(obj.sizes);
  const colors = normalizeArray(obj.colors);
  const images = normalizeArray(obj.images);
  const originalPrice = obj.originalPrice ?? obj.mrp ?? obj.price;
  const stock = Number.isFinite(obj.stock) ? obj.stock : 0;

  const categoryFromRef = obj.categoryId && typeof obj.categoryId === 'object' ? obj.categoryId.name : undefined;
  const category = obj.category || categoryFromRef || '';

  const base = {
    id: obj._id ? obj._id.toString() : undefined,
    _id: obj._id,
    name: obj.name,
    description: obj.description || '',
    category,
    collection: obj.collection || '',
    price: obj.price,
    originalPrice,
    mrp: obj.mrp,
    images,
    image: images[0] || null,
    stock,
    isNew: Boolean(obj.isNew),
    isBestSeller: Boolean(obj.isBestSeller),
    isLimited: obj.isLimited === undefined ? stock > 0 && stock <= 5 : Boolean(obj.isLimited),
    rating: Number(obj.rating || 0),
    reviewCount: Number(obj.reviewCount || 0),
    sizes: sizes.length ? sizes : derivedSizes,
    variants,
    colors: colors.length ? colors : derivedColors,
    viewCount: Number(obj.viewCount || 0),
    addedToCartCount: Number(obj.addedToCartCount || 0),
    trendingScore: Number(obj.trendingScore || 0),
    dropDate: obj.dropDate || null,
    releaseDate: obj.releaseDate || null,
    productSpecifications: obj.productSpecifications || {},
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt
  };

  if (options.cardOnly) {
    return {
      id: base.id,
      _id: base._id,
      name: base.name,
      price: base.price,
      originalPrice: base.originalPrice,
      images: base.images,
      image: base.image,
      category: base.category,
      collection: base.collection,
      stock: base.stock,
      sizes: base.sizes,
      variants: base.variants,
      isNew: base.isNew,
      isBestSeller: base.isBestSeller,
      isLimited: base.isLimited
    };
  }

  return base;
}

function normalizeOrderStatus(status) {
  if (!status) return 'Processing';
  const map = {
    placed: 'Processing',
    confirmed: 'Processing',
    shipped: 'Shipped',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    returned: 'Returned'
  };
  const key = String(status).toLowerCase();
  return map[key] || status;
}

function toAccountOrder(order) {
  if (!order) return null;
  const obj = order.toObject ? order.toObject() : { ...order };
  return {
    id: obj._id ? obj._id.toString() : undefined,
    date: obj.createdAt,
    status: normalizeOrderStatus(obj.orderStatus),
    total: obj.totalAmount,
    items: (obj.items || []).map((item) => ({
      productId: item.productId,
      name: item.name,
      qty: item.quantity,
      size: item.size || null,
      color: item.color || null,
      price: item.price,
      image: item.image || null
    })),
    shippingAddress: obj.shippingAddress || null,
    paymentMethod: obj.paymentMethod || null,
    invoiceUrl: obj.invoiceUrl || null,
    trackingUrl: obj.trackingUrl || null,
    returnEligible: Boolean(obj.returnEligible)
  };
}

function toAddressResponse(address) {
  if (!address) return null;
  const obj = address.toObject ? address.toObject() : { ...address };
  return {
    id: obj._id ? obj._id.toString() : undefined,
    name: obj.name || '',
    phone: obj.phone || '',
    line1: obj.line1,
    line2: obj.line2 || '',
    city: obj.city,
    state: obj.state || '',
    pincode: obj.pincode || obj.postalCode || '',
    landmark: obj.landmark || '',
    instructions: obj.instructions || '',
    isDefault: Boolean(obj.isDefault)
  };
}

module.exports = {
  toProductResponse,
  toAccountOrder,
  toAddressResponse
};
