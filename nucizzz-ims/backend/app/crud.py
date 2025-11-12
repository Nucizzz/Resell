from sqlalchemy.orm import Session
from sqlalchemy import select, update
from . import models, schemas

def get_or_create_location(db: Session, name: str) -> models.Location:
    loc = db.scalar(select(models.Location).where(models.Location.name == name))
    if loc:
        return loc
    loc = models.Location(name=name)
    db.add(loc)
    db.commit()
    db.refresh(loc)
    return loc

def create_product(db: Session, data: schemas.ProductCreate) -> models.Product:
    # no doppioni di barcode o sku
    if data.barcode:
        exists = db.scalar(select(models.Product).where(models.Product.barcode == data.barcode))
        if exists:
            raise ValueError("Barcode già presente")
    exists_sku = db.scalar(select(models.Product).where(models.Product.sku == data.sku))
    if exists_sku:
        raise ValueError("SKU già presente")

    p = models.Product(
        sku=data.sku,
        barcode=data.barcode,
        title=data.title,
        brand=data.brand,
        description=data.description,
        size=data.size,
        color=data.color,
        weight_grams=data.weight_grams,
        package_required=data.package_required,
        cost=data.cost,
        price=data.price,
        image_url=data.image_url,
        is_active=data.is_active if data.is_active is not None else True,
    )
    db.add(p)
    db.commit()
    db.refresh(p)

    # stock iniziale
    if data.initial_qty and data.initial_qty > 0 and data.location_id:
        s = models.Stock(product_id=p.id, location_id=data.location_id, qty=data.initial_qty)
        db.add(s)
        mv = models.StockMovement(
            product_id=p.id, type="in", qty_change=data.initial_qty,
            from_location_id=None, to_location_id=data.location_id, note="Initial stock"
        )
        db.add(mv)
        db.commit()

    return p

def update_product(db: Session, product_id: int, data: dict) -> models.Product:
    p = db.get(models.Product, product_id)
    if not p:
        raise ValueError("Prodotto non trovato")
    for k, v in data.items():
        if hasattr(p, k) and v is not None:
            setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return p

def list_products(db: Session, q: str | None = None, location_id: int | None = None, limit: int = 50, offset: int = 0):
    stmt = select(models.Product).order_by(models.Product.created_at.desc())
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(
            (models.Product.sku.ilike(like)) |
            (models.Product.title.ilike(like)) |
            (models.Product.barcode.ilike(like)) |
            (models.Product.brand.ilike(like))
        )
    res = db.scalars(stmt.offset(offset).limit(limit)).all()
    return res

def get_product_by_barcode(db: Session, barcode: str) -> models.Product | None:
    return db.scalar(select(models.Product).where(models.Product.barcode == barcode))

def get_product(db: Session, pid: int) -> models.Product | None:
    return db.get(models.Product, pid)

def upsert_stock(db: Session, product_id: int, location_id: int, delta: int, movement_type: str, note: str | None = None):
    s = db.scalar(select(models.Stock).where(
        (models.Stock.product_id == product_id) &
        (models.Stock.location_id == location_id)
    ))
    if s:
        s.qty += delta
    else:
        s = models.Stock(product_id=product_id, location_id=location_id, qty=max(0, delta))
        db.add(s)

    mv = models.StockMovement(
        product_id=product_id, type=movement_type, qty_change=delta,
        from_location_id=None if delta > 0 else location_id if movement_type == "out" else None,
        to_location_id=location_id if delta > 0 else None,
        note=note
    )
    db.add(mv)
    db.commit()
    db.refresh(mv)
    return mv

def transfer_stock(db: Session, product_id: int, from_loc: int, to_loc: int, qty: int):
    # decrementa
    s_from = db.scalar(select(models.Stock).where(
        (models.Stock.product_id == product_id) & (models.Stock.location_id == from_loc)))
    if not s_from or s_from.qty < qty:
        raise ValueError("Stock insufficiente per trasferimento")
    s_from.qty -= qty

    # incrementa
    s_to = db.scalar(select(models.Stock).where(
        (models.Stock.product_id == product_id) & (models.Stock.location_id == to_loc)))
    if s_to:
        s_to.qty += qty
    else:
        s_to = models.Stock(product_id=product_id, location_id=to_loc, qty=qty)
        db.add(s_to)

    mv = models.StockMovement(
        product_id=product_id, type="transfer", qty_change=qty,
        from_location_id=from_loc, to_location_id=to_loc, note="Transfer"
    )
    db.add(mv)
    db.commit()
    db.refresh(mv)
    return mv
