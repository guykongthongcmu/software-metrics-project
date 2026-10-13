const makeItems = (category, entries) => entries.map(([label, query, image]) => ({
  label,
  query,
  image: `/images/${image}`,
  href: `/search?q=${encodeURIComponent(query)}&cat=${category}&sort=relevance`,
}))

export const megaMenuData = {
  men: makeItems('men', [
    ['T-Shirts & Sweatshirts', 't-shirt', 'men-tshirt.jpg'], ['Shirts & Polo Shirts', 'shirt', 'men-polo.jpg'],
    ['Knitwear & Sweaters', 'knit', 'men-knit.jpg'], ['Outerwear', 'outer', 'men-outer.jpg'],
    ['Pants', 'pant', 'men-pants.jpg'], ['Innerwear & Socks', 'inner', 'men-suit.jpg'],
    ['Loungewear', 'lounge', 'men-trial.jpg'], ['Linen', 'linen', 'men-linen.jpg'],
    ['Sport Utility Wear', 'sport', 'men-sport.jpg'], ['UV Protection Collection', 'uv', 'men-uv.jpg'],
    ['AIRism', 'air', 'men-airism.jpg'], ['HEATTECH', 'heat', 'men-heattech.jpg'],
    ['Accessories', 'accessory', 'men-acc.jpg'], ['Special Collaborations', 'collab', 'men-collab.jpg'],
    ['New Arrivals', 'new', 'men-new.jpg'], ['Price Down', 'sale', 'men-sale.jpg'],
  ]),
  women: makeItems('women', [
    ['T-Shirts & Sweats & Bra Tops', 't-shirt', 'women-tshirt.jpg'], ['Shirts & Polo Shirts', 'shirt', 'women-polo.jpg'],
    ['Knitwear & Cardigans', 'knit', 'women-knit.jpg'], ['Outerwear', 'outer', 'women-outer.jpg'],
    ['Bottoms', 'pant', 'women-bottoms.jpg'], ['Dresses & Skirts', 'dress', 'women-dress.jpg'],
    ['Innerwear & Socks', 'inner', 'women-inner.jpg'], ['Loungewear', 'lounge', 'women-lounge.jpg'],
    ['Linen', 'linen', 'women-linen.jpg'], ['Accessories', 'accessory', 'women-acc.jpg'],
    ['Sport Utility Wear', 'sport', 'women-sport.jpg'], ['UV Protection Collection', 'uv', 'women-uv.jpg'],
    ['AIRism', 'air', 'women-airism.jpg'], ['HEATTECH', 'heat', 'women-heattech.jpg'],
    ['Maternity', 'maternity', 'women-maternity.jpg'], ['New Arrivals', 'new', 'women-new.jpg'],
  ]),
  kids: makeItems('kids', [
    ['T-Shirts & Sweatshirts', 't-shirt', 'kids-tshirt.jpg'], ['Shirts & Blouses', 'shirt', 'kids-shirts.jpg'],
    ['Outerwear', 'out', 'kids-outer.jpg'], ['Bottoms', 'pant', 'kids-bottoms.jpg'],
    ['Dresses & Skirts', 'dress', 'kids-dresses.jpg'], ['Activewear', 'active', 'kids-active.jpg'],
    ['Innerwear & Socks', 'inner', 'kids-inner.jpg'], ['Pajamas', 'pajamas', 'kids-pajamas.jpg'],
    ['Accessories', 'accessory', 'kids-acc.jpg'], ['AIRism', 'air', 'kids-airism.jpg'],
    ['HEATTECH', 'heat', 'kids-heattech.jpg'], ['Special Collaborations', 'col', 'kids-collab.jpg'],
  ]),
  baby: makeItems('baby', [
    ['Bodysuits & Rompers', 'bodysuit', 'baby-bodysuit.jpg'], ['Tops & T-Shirts', 'top', 'baby-tops.jpg'],
    ['Bottoms & Leggings', 'pant', 'baby-bottoms.jpg'], ['Dresses & Skirts', 'dress', 'baby-dresses.jpg'],
    ['Outerwear', 'outer', 'baby-outer.jpg'], ['Innerwear & Socks', 'inner', 'baby-inner.jpg'],
    ['Pajamas & Sleepwear', 'pajamas', 'baby-pajamas.jpg'], ['Accessories', 'accessory', 'baby-acc.jpg'],
    ['Maternity & Newborn', 'maternity', 'baby-newborn.jpg'], ['AIRism', 'air', 'baby-airism.jpg'],
    ['HEATTECH', 'heat', 'baby-heattech.jpg'], ['Special Collaborations', 'collab', 'baby-collab.jpg'],
  ]),
  unisex: makeItems('unisex', [
    ['T-Shirts', 'tops', 'unisex-tshirt.jpg'], ['Sweatshirts & Hoodies', 'shirt', 'unisex-sweatshirts.jpg'],
    ['Outerwear', 'outer', 'unisex-outer.jpg'], ['Bottoms', 'pant', 'unisex-bottoms.jpg'],
    ['Activewear', 'active', 'unisex-active.jpg'], ['Loungewear', 'lounge', 'unisex-lounge.jpg'],
    ['Accessories', 'accessory', 'unisex-acc.jpg'], ['Bags', 'bag', 'unisex-bags.jpg'],
    ['Shoes', 'shoe', 'unisex-shoes.jpg'], ['Sunglasses', 'sunglass', 'unisex-sunglasses.jpg'],
    ['AIRism', 'air', 'unisex-airism.jpg'], ['Special Collaborations', 'collab', 'unisex-collab.jpg'],
  ]),
}