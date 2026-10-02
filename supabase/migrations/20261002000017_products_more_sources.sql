-- More barcode databases: the products source may now also be Open Products Facts, Open Pet Food Facts or UPCitemdb.
alter table public.products drop constraint if exists products_source_check;
alter table public.products add constraint products_source_check check (source in ('openfoodfacts','openbeautyfacts','openproductsfacts','openpetfoodfacts','upcitemdb','manual'));
