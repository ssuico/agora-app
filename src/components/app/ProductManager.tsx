import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ImageIcon, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Store {
  _id: string;
  name: string;
}

interface Product {
  _id: string;
  name: string;
  images: string[];
  costPrice: number;
  sellingPrice: number;
  stockQuantity: number;
  storeId: string;
  createdAt: string;
}

interface ProductFormData {
  storeId: string;
  name: string;
  images: string[];
  costPrice: string;
  sellingPrice: string;
  stockQuantity: string;
}

interface ProductManagerProps {
  storeId?: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n);

function ProductImage({ src, className }: { src?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`flex items-center justify-center bg-muted rounded ${className}`}>
        <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className={`object-cover rounded ${className}`}
      onError={() => setFailed(true)}
    />
  );
}

export function ProductManager({ storeId: fixedStoreId }: ProductManagerProps) {
  const isScoped = !!fixedStoreId;

  const emptyForm: ProductFormData = {
    storeId: fixedStoreId ?? '',
    name: '',
    images: [],
    costPrice: '',
    sellingPrice: '',
    stockQuantity: '',
  };

  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStoreId, setFilterStoreId] = useState<string>(fixedStoreId ?? 'all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductFormData>(emptyForm);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const storeMap = new Map(stores.map((s) => [s._id, s.name]));

  const fetchStores = async () => {
    if (isScoped) return;
    try {
      const res = await fetch('/api/stores');
      if (res.ok) setStores(await res.json());
    } catch {
      /* ignore */
    }
  };

  const fetchProducts = async (sid?: string) => {
    try {
      const effectiveId = sid ?? fixedStoreId;
      const query = effectiveId && effectiveId !== 'all' ? `?storeId=${effectiveId}` : '';
      const res = await fetch(`/api/products${query}`);
      if (res.ok) setProducts(await res.json());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
    fetchProducts(filterStoreId);
  }, []);

  useEffect(() => {
    if (!isScoped) fetchProducts(filterStoreId);
  }, [filterStoreId]);

  const openCreate = () => {
    setEditingProduct(null);
    setForm(emptyForm);
    setNewImageUrl('');
    setError('');
    setDialogOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    setForm({
      storeId: fixedStoreId ?? product.storeId,
      name: product.name,
      images: product.images ?? [],
      costPrice: String(product.costPrice),
      sellingPrice: String(product.sellingPrice),
      stockQuantity: String(product.stockQuantity),
    });
    setNewImageUrl('');
    setError('');
    setDialogOpen(true);
  };

  const openDelete = (product: Product) => {
    setDeletingProduct(product);
    setError('');
    setDeleteDialogOpen(true);
  };

  const addImage = () => {
    const url = newImageUrl.trim();
    if (!url) return;
    setForm((prev) => ({ ...prev, images: [...prev.images, url] }));
    setNewImageUrl('');
  };

  const removeImage = (index: number) => {
    setForm((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const payload = {
      storeId: form.storeId,
      name: form.name.trim(),
      images: form.images,
      costPrice: parseFloat(form.costPrice) || 0,
      sellingPrice: parseFloat(form.sellingPrice) || 0,
      stockQuantity: parseInt(form.stockQuantity, 10) || 0,
    };

    try {
      const url = editingProduct ? `/api/products/${editingProduct._id}` : '/api/products';
      const method = editingProduct ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        setError(data.message ?? 'Something went wrong');
        return;
      }

      setDialogOpen(false);
      await fetchProducts(filterStoreId);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingProduct) return;
    setSubmitting(true);

    try {
      const res = await fetch(`/api/products/${deletingProduct._id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        setError(data.message ?? 'Failed to delete product');
        return;
      }
      setDeleteDialogOpen(false);
      setDeletingProduct(null);
      await fetchProducts(filterStoreId);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (field: keyof ProductFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Products</h1>
            <p className="text-sm text-muted-foreground">
              Manage your product catalog and inventory
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          Loading products...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">
            Manage your product catalog and inventory
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" />
          Add Product
        </Button>
      </div>

      {!isScoped && stores.length > 0 && (
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">Filter by store:</Label>
          <Select value={filterStoreId} onValueChange={setFilterStoreId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Stores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stores</SelectItem>
              {stores.map((store) => (
                <SelectItem key={store._id} value={store._id}>
                  {store.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground w-16">Image</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
              {!isScoped && (
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Store</th>
              )}
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Cost Price</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Selling Price
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Stock</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td
                  colSpan={isScoped ? 6 : 7}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No products found. Click "Add Product" to create one.
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr key={product._id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="px-4 py-2">
                    <ProductImage
                      src={product.images?.[0]}
                      className="h-10 w-10"
                    />
                  </td>
                  <td className="px-4 py-3 font-medium">{product.name}</td>
                  {!isScoped && (
                    <td className="px-4 py-3 text-muted-foreground">
                      {storeMap.get(product.storeId) ?? '-'}
                    </td>
                  )}
                  <td className="px-4 py-3">{fmt(product.costPrice)}</td>
                  <td className="px-4 py-3">{fmt(product.sellingPrice)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        product.stockQuantity === 0
                          ? 'bg-red-100 text-red-700'
                          : product.stockQuantity < 10
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {product.stockQuantity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(product)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => openDelete(product)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Edit Product' : 'Add Product'}</DialogTitle>
            <DialogDescription>
              {editingProduct
                ? 'Update the product details below.'
                : 'Fill in the details to add a new product.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isScoped && (
              <div className="space-y-2">
                <Label htmlFor="product-store">Store</Label>
                <Select
                  value={form.storeId}
                  onValueChange={(val) => updateField('storeId', val)}
                >
                  <SelectTrigger id="product-store" className="w-full">
                    <SelectValue placeholder="Select a store" />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map((store) => (
                      <SelectItem key={store._id} value={store._id}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="product-name">Product Name</Label>
              <Input
                id="product-name"
                placeholder="e.g. Rice (25kg)"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                required
              />
            </div>

            {/* Images section */}
            <div className="space-y-2">
              <Label>Product Images</Label>
              {form.images.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {form.images.map((url, i) => (
                    <div key={i} className="relative group">
                      <ProductImage src={url} className="h-16 w-16 border" />
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute -right-1.5 -top-1.5 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="Paste image URL..."
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addImage();
                    }
                  }}
                />
                <Button type="button" variant="outline" size="sm" onClick={addImage} disabled={!newImageUrl.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Add image URLs one at a time. The first image will be used as the thumbnail.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="product-cost">Cost Price (PHP)</Label>
                <Input
                  id="product-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.costPrice}
                  onChange={(e) => updateField('costPrice', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-selling">Selling Price (PHP)</Label>
                <Input
                  id="product-selling"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.sellingPrice}
                  onChange={(e) => updateField('sellingPrice', e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-stock">Stock Quantity</Label>
              <Input
                id="product-stock"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={form.stockQuantity}
                onChange={(e) => updateField('stockQuantity', e.target.value)}
                required
              />
            </div>
            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !form.storeId}>
                {submitting ? 'Saving...' : editingProduct ? 'Save Changes' : 'Create Product'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deletingProduct?.name}</strong>? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={submitting}>
              {submitting ? 'Deleting...' : 'Delete Product'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
