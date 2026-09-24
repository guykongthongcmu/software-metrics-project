const ADDITIONAL_TOP_LEVEL_CATEGORIES = [
  {
    categoryId: 11,
    categoryName: 'Kids',
    slug: 'kids',
    translations: {
      EN: 'Kids',
      TH: 'เด็ก',
    },
  },
  {
    categoryId: 12,
    categoryName: 'Baby',
    slug: 'baby',
    translations: {
      EN: 'Baby',
      TH: 'เบบี้',
    },
  },
  {
    categoryId: 13,
    categoryName: 'Unisex',
    slug: 'unisex',
    translations: {
      EN: 'Unisex',
      TH: 'ยูนิเซ็กซ์',
    },
  },
];

const EXISTING_TOP_LEVEL_ASSIGNMENTS = [
  { productId: 1001, categoryId: 1 },
  { productId: 1002, categoryId: 1 },
  { productId: 1003, categoryId: 1 },
  { productId: 1004, categoryId: 1 },
  { productId: 1007, categoryId: 1 },
  { productId: 1011, categoryId: 1 },
  { productId: 1005, categoryId: 2 },
  { productId: 1006, categoryId: 2 },
  { productId: 1008, categoryId: 2 },
  { productId: 1012, categoryId: 2 },
  { productId: 1009, categoryId: 13 },
  { productId: 1010, categoryId: 13 },
];

const GROUPS = {
  men: {
    labelEn: 'Men',
    labelTh: 'ผู้ชาย',
    categoryId: 1,
    priceOffset: 120,
    topSizes: ['M', 'L'],
    bottomSizes: ['32', '34'],
    accessorySizes: ['ONE', 'ONE'],
  },
  women: {
    labelEn: 'Women',
    labelTh: 'ผู้หญิง',
    categoryId: 2,
    priceOffset: 90,
    topSizes: ['S', 'M'],
    bottomSizes: ['S', 'M'],
    accessorySizes: ['ONE', 'ONE'],
  },
  kids: {
    labelEn: 'Kids',
    labelTh: 'เด็ก',
    categoryId: 11,
    priceOffset: 30,
    topSizes: ['110', '120'],
    bottomSizes: ['110', '120'],
    accessorySizes: ['ONE', 'ONE'],
  },
  baby: {
    labelEn: 'Baby',
    labelTh: 'เบบี้',
    categoryId: 12,
    priceOffset: 0,
    topSizes: ['80', '90'],
    bottomSizes: ['80', '90'],
    accessorySizes: ['ONE', 'ONE'],
  },
  unisex: {
    labelEn: 'Unisex',
    labelTh: 'ยูนิเซ็กซ์',
    categoryId: 13,
    priceOffset: 70,
    topSizes: ['M', 'L'],
    bottomSizes: ['M', 'L'],
    accessorySizes: ['ONE', 'ONE'],
  },
};

const GROUP_ASSETS = {
  men: [
    'men-knit.jpg',
    'men-suit.jpg',
    'men-outer.jpg',
    'men-sport.jpg',
    'men-acc.jpg',
    'men-trial.jpg',
    'men-heattech.jpg',
    'men-airism.jpg',
    'men-polo.jpg',
    'men-tshirt.jpg',
    'men-pants.jpg',
    'men-linen.jpg',
    'men-uv.jpg',
    'linen_shirt.jpg',
  ],
  women: [
    'women-inner.jpg',
    'women-airism.jpg',
    'women-bottoms.jpg',
    'women-tshirt.jpg',
    'women-polo.jpg',
    'women-sport.jpg',
    'women-outer.jpg',
    'women-acc.jpg',
    'women-lounge.jpg',
    'women-uv.jpg',
    'women-dress.jpg',
    'women-heattech.jpg',
    'women-linen.jpg',
    'women-knit.jpg',
    'women-maternity.jpg',
  ],
  kids: [
    'kids-dresses.jpg',
    'kids-outer.jpg',
    'kids-pajamas.jpg',
    'kids-heattech.jpg',
    'kids-tshirt.jpg',
    'kids-shirts.jpg',
    'kids-active.jpg',
    'kids-inner.jpg',
    'kids-bottoms.jpg',
    'kids-airism.jpg',
    'kids-acc.jpg',
  ],
  baby: [
    'baby-bodysuit.jpg',
    'baby-newborn.jpg',
    'baby-bottoms.jpg',
    'baby-outer.jpg',
    'baby-acc.jpg',
    'baby-airism.jpg',
    'baby-tops.jpg',
    'baby-heattech.jpg',
    'baby-pajamas.jpg',
    'baby-dresses.jpg',
    'baby-inner.jpg',
  ],
  unisex: [
    'unisex-airism.jpg',
    'unisex-sweatshirts.jpg',
    'unisex-outer.jpg',
    'unisex-bags.jpg',
    'unisex-active.jpg',
    'unisex-sunglasses.jpg',
    'unisex-tshirt.jpg',
    'unisex-lounge.jpg',
    'unisex-shoes.jpg',
    'unisex-bottoms.jpg',
    'unisex-acc.jpg',
  ],
};

const KEYWORD_META = {
  knit: {
    nameEn: 'Knit Layer',
    nameTh: 'เสื้อถักเลเยอร์',
    descriptionEn: 'Soft knit texture for easy layering through changing weather.',
    descriptionTh: 'เนื้อผ้าถักนุ่มสำหรับใส่เลเยอร์ในวันที่อากาศเปลี่ยน',
    productType: 'TOP',
    colors: ['Camel', 'Oat'],
    basePrice: 1390,
    compareDelta: 250,
  },
  suit: {
    nameEn: 'Tailored Jacket',
    nameTh: 'แจ็กเก็ตเทเลอร์',
    descriptionEn: 'Clean tailoring that sharpens everyday styling without feeling too formal.',
    descriptionTh: 'งานตัดเย็บคมชัดที่ทำให้ลุคประจำวันดูเรียบเนี้ยบ',
    productType: 'TOP',
    colors: ['Charcoal', 'Stone'],
    basePrice: 2190,
    compareDelta: 300,
  },
  outer: {
    nameEn: 'Field Jacket',
    nameTh: 'แจ็กเก็ตฟิลด์',
    descriptionEn: 'A light outer layer built for daily commutes and weekend plans.',
    descriptionTh: 'เสื้อคลุมเนื้อเบาที่ใส่ได้ทั้งวันทำงานและวันหยุด',
    productType: 'TOP',
    colors: ['Olive', 'Navy'],
    basePrice: 1890,
    compareDelta: 260,
  },
  sport: {
    nameEn: 'Performance Tee',
    nameTh: 'เสื้อออกกำลังกาย',
    descriptionEn: 'Quick-dry performance fabric that keeps movement easy and comfortable.',
    descriptionTh: 'ผ้าแห้งเร็วที่ช่วยให้เคลื่อนไหวได้คล่องตัวและสบาย',
    productType: 'TOP',
    colors: ['Black', 'Slate'],
    basePrice: 890,
    compareDelta: 180,
  },
  acc: {
    nameEn: 'Accessory Edit',
    nameTh: 'แอ็กเซสซอรีประจำวัน',
    descriptionEn: 'Everyday finishing piece that adds utility without extra bulk.',
    descriptionTh: 'ชิ้นแอ็กเซสซอรีที่เพิ่มการใช้งานในทุกวันโดยไม่เทอะทะ',
    productType: 'ACCESSORY',
    colors: ['Brown', 'Black'],
    basePrice: 690,
    compareDelta: 150,
  },
  trial: {
    nameEn: 'Relaxed Lounge Shorts',
    nameTh: 'กางเกงลำลองทรงสบาย',
    descriptionEn: 'Easy pull-on silhouette built for off-duty comfort and travel days.',
    descriptionTh: 'ทรงใส่ง่ายสำหรับวันสบาย ๆ และวันที่ต้องเดินทาง',
    productType: 'BOTTOM',
    colors: ['Taupe', 'Charcoal'],
    basePrice: 850,
    compareDelta: 120,
  },
  heattech: {
    nameEn: 'Heattech Base Layer',
    nameTh: 'ชั้นในฮีทเทค',
    descriptionEn: 'A close-to-body thermal piece that keeps warmth in without feeling heavy.',
    descriptionTh: 'เสื้อชั้นในกันหนาวที่ให้ความอบอุ่นโดยไม่หนาเทอะทะ',
    productType: 'TOP',
    colors: ['Black', 'Graphite'],
    basePrice: 790,
    compareDelta: 160,
  },
  airism: {
    nameEn: 'Airism Tee',
    nameTh: 'เสื้อแอริซึม',
    descriptionEn: 'Smooth cooling fabric for warm weather, travel, and layered outfits.',
    descriptionTh: 'ผ้าสัมผัสเย็นลื่นสำหรับอากาศร้อน การเดินทาง และการใส่เลเยอร์',
    productType: 'TOP',
    colors: ['White', 'Steel'],
    basePrice: 690,
    compareDelta: 120,
  },
  polo: {
    nameEn: 'Polo Shirt',
    nameTh: 'เสื้อโปโล',
    descriptionEn: 'Smart casual polo with a clean collar and polished drape.',
    descriptionTh: 'เสื้อโปโลลุคสมาร์ตแคชชวลพร้อมปกเสื้อเรียบเนี้ยบ',
    productType: 'TOP',
    colors: ['White', 'Blue'],
    basePrice: 990,
    compareDelta: 180,
  },
  tshirt: {
    nameEn: 'Cotton Tee',
    nameTh: 'เสื้อยืดคอตตอน',
    descriptionEn: 'A dependable everyday tee with soft handfeel and an easy silhouette.',
    descriptionTh: 'เสื้อยืดทรงใส่ง่าย เนื้อผ้านุ่ม เหมาะกับการใส่ทุกวัน',
    productType: 'TOP',
    colors: ['White', 'Black'],
    basePrice: 490,
    compareDelta: 100,
  },
  pants: {
    nameEn: 'Relaxed Pants',
    nameTh: 'กางเกงทรงสบาย',
    descriptionEn: 'Relaxed cut with room to move and a clean straight finish.',
    descriptionTh: 'กางเกงทรงสบายที่ขยับตัวง่ายและดูเรียบร้อย',
    productType: 'BOTTOM',
    colors: ['Olive', 'Black'],
    basePrice: 1290,
    compareDelta: 220,
  },
  linen: {
    nameEn: 'Linen Resort Shirt',
    nameTh: 'เสื้อเชิ้ตลินินรีสอร์ต',
    descriptionEn: 'Lightweight linen blend made for hot days and laid-back styling.',
    descriptionTh: 'เสื้อเชิ้ตลินินผ้าเบาที่เหมาะกับอากาศร้อนและลุคสบาย ๆ',
    productType: 'TOP',
    colors: ['Sand', 'Navy'],
    basePrice: 1090,
    compareDelta: 200,
  },
  linen_shirt: {
    nameEn: 'Premium Linen Shirt',
    nameTh: 'เสื้อเชิ้ตลินินพรีเมียม',
    descriptionEn: 'An airy linen shirt that keeps the silhouette crisp and breathable.',
    descriptionTh: 'เสื้อเชิ้ตลินินที่ระบายอากาศดีและคงทรงสวย',
    productType: 'TOP',
    colors: ['Beige', 'Stone'],
    basePrice: 1190,
    compareDelta: 250,
  },
  uv: {
    nameEn: 'UV Shield Hoodie',
    nameTh: 'ฮู้ดดี้กันยูวี',
    descriptionEn: 'Protective lightweight layer built for commuting, travel, and sun coverage.',
    descriptionTh: 'เสื้อคลุมน้ำหนักเบาที่ช่วยปกป้องจากแดดในทุกวัน',
    productType: 'TOP',
    colors: ['Mist', 'Navy'],
    basePrice: 990,
    compareDelta: 150,
  },
  inner: {
    nameEn: 'Soft Inner Layer',
    nameTh: 'เสื้อชั้นในนุ่มสบาย',
    descriptionEn: 'Smooth stretch innerwear designed to sit comfortably under layers.',
    descriptionTh: 'ชั้นในผ้ายืดนุ่มที่ใส่สบายใต้เสื้อผ้าหลายชั้น',
    productType: 'TOP',
    colors: ['Ivory', 'Rose'],
    basePrice: 590,
    compareDelta: 90,
  },
  bottoms: {
    nameEn: 'Easy Bottoms',
    nameTh: 'กางเกงใส่ง่าย',
    descriptionEn: 'Easy movement and a clean line make this pair work across the week.',
    descriptionTh: 'กางเกงที่ใส่ง่าย ขยับสะดวก และแมตช์ได้ตลอดสัปดาห์',
    productType: 'BOTTOM',
    colors: ['Stone', 'Black'],
    basePrice: 990,
    compareDelta: 150,
  },
  dress: {
    nameEn: 'Everyday Dress',
    nameTh: 'เดรสประจำวัน',
    descriptionEn: 'An easy one-piece silhouette with soft drape and everyday versatility.',
    descriptionTh: 'เดรสทรงใส่ง่าย พริ้วสวย และเหมาะกับการใช้งานทุกวัน',
    productType: 'TOP',
    colors: ['Navy', 'Blush'],
    basePrice: 1290,
    compareDelta: 200,
  },
  dresses: {
    nameEn: 'Play Dress',
    nameTh: 'เดรสใส่เล่น',
    descriptionEn: 'Play-ready comfort with a soft feel and an easy fit through the day.',
    descriptionTh: 'เดรสที่ใส่สบายสำหรับวิ่งเล่นและใช้งานได้ทั้งวัน',
    productType: 'TOP',
    colors: ['Lilac', 'Coral'],
    basePrice: 790,
    compareDelta: 120,
  },
  maternity: {
    nameEn: 'Maternity Knit Top',
    nameTh: 'เสื้อถักสำหรับคุณแม่',
    descriptionEn: 'Soft stretch support designed to stay comfortable through changing shape.',
    descriptionTh: 'เสื้อถักยืดนุ่มที่รองรับการเปลี่ยนแปลงของสรีระอย่างสบาย',
    productType: 'TOP',
    colors: ['Oat', 'Dusty Rose'],
    basePrice: 1190,
    compareDelta: 180,
  },
  bodysuit: {
    nameEn: 'Cotton Bodysuit',
    nameTh: 'บอดี้สูทคอตตอน',
    descriptionEn: 'Soft snap bodysuit made for easy changes and all-day comfort.',
    descriptionTh: 'บอดี้สูทเนื้อนุ่มที่เปลี่ยนง่ายและใส่สบายตลอดวัน',
    productType: 'TOP',
    colors: ['Cloud', 'Mint'],
    basePrice: 450,
    compareDelta: 80,
  },
  newborn: {
    nameEn: 'Newborn Welcome Set',
    nameTh: 'เซ็ตแรกเกิด',
    descriptionEn: 'Gentle starter set for newborn comfort with easy layering pieces.',
    descriptionTh: 'เซ็ตแรกเกิดเนื้อสัมผัสอ่อนโยนพร้อมชิ้นเลเยอร์ที่ใส่ง่าย',
    productType: 'TOP',
    colors: ['Cream', 'Powder Blue'],
    basePrice: 590,
    compareDelta: 100,
  },
  tops: {
    nameEn: 'Everyday Top',
    nameTh: 'เสื้อใส่ทุกวัน',
    descriptionEn: 'Lightweight essential top built for repeat wear and easy styling.',
    descriptionTh: 'เสื้อเบสิคที่หยิบใส่ได้บ่อยและแมตช์ง่าย',
    productType: 'TOP',
    colors: ['Peach', 'Sky'],
    basePrice: 520,
    compareDelta: 90,
  },
  pajamas: {
    nameEn: 'Sleep Set',
    nameTh: 'ชุดนอน',
    descriptionEn: 'A soft bedtime set designed for comfort from evening through morning.',
    descriptionTh: 'ชุดนอนเนื้อนุ่มที่สบายตั้งแต่ก่อนนอนจนถึงเช้า',
    productType: 'BOTTOM',
    colors: ['Lavender', 'Blue'],
    basePrice: 690,
    compareDelta: 120,
  },
  active: {
    nameEn: 'Active Set',
    nameTh: 'ชุดแอ็กทีฟ',
    descriptionEn: 'Lightweight set designed to move easily from play to practice.',
    descriptionTh: 'ชุดแอ็กทีฟน้ำหนักเบาที่ใส่ได้ตั้งแต่เล่นจนถึงออกกำลังกาย',
    productType: 'TOP',
    colors: ['Red', 'Navy'],
    basePrice: 790,
    compareDelta: 120,
  },
  shirts: {
    nameEn: 'Woven Shirt',
    nameTh: 'เสื้อเชิ้ตผ้าทอ',
    descriptionEn: 'Structured woven shirt that still feels soft enough for daily wear.',
    descriptionTh: 'เสื้อเชิ้ตผ้าทอที่ยังคงใส่สบายสำหรับทุกวัน',
    productType: 'TOP',
    colors: ['Blue', 'White'],
    basePrice: 790,
    compareDelta: 120,
  },
  bag: {
    nameEn: 'Canvas Carry Bag',
    nameTh: 'กระเป๋าผ้าแคนวาส',
    descriptionEn: 'Durable canvas carry-all built for errands, classes, and daily use.',
    descriptionTh: 'กระเป๋าผ้าแคนวาสทนทานสำหรับใช้งานในชีวิตประจำวัน',
    productType: 'ACCESSORY',
    colors: ['Natural', 'Black'],
    basePrice: 790,
    compareDelta: 150,
  },
  bags: {
    nameEn: 'Canvas Carry Bag',
    nameTh: 'กระเป๋าผ้าแคนวาส',
    descriptionEn: 'Durable canvas carry-all built for errands, classes, and daily use.',
    descriptionTh: 'กระเป๋าผ้าแคนวาสทนทานสำหรับใช้งานในชีวิตประจำวัน',
    productType: 'ACCESSORY',
    colors: ['Natural', 'Black'],
    basePrice: 790,
    compareDelta: 150,
  },
  sweatshirts: {
    nameEn: 'Fleece Sweatshirt',
    nameTh: 'สเวตเชิ้ตฟลีซ',
    descriptionEn: 'Brushed fleece comfort that works as a core layer in cooler weather.',
    descriptionTh: 'สเวตเชิ้ตฟลีซนุ่มสบายสำหรับอากาศเย็น',
    productType: 'TOP',
    colors: ['Heather Grey', 'Forest'],
    basePrice: 1090,
    compareDelta: 180,
  },
  sunglasses: {
    nameEn: 'Tinted Sunglasses',
    nameTh: 'แว่นกันแดด',
    descriptionEn: 'Clean everyday sunglasses that sharpen the look without overdoing it.',
    descriptionTh: 'แว่นกันแดดดีไซน์เรียบที่ใส่ได้ทุกวัน',
    productType: 'ACCESSORY',
    colors: ['Black', 'Tortoise'],
    basePrice: 590,
    compareDelta: 90,
  },
  lounge: {
    nameEn: 'Lounge Pants',
    nameTh: 'กางเกงลำลอง',
    descriptionEn: 'Relaxed lounge fit with a soft finish for easy off-duty wear.',
    descriptionTh: 'กางเกงลำลองทรงสบาย เนื้อผ้านุ่ม เหมาะกับวันพักผ่อน',
    productType: 'BOTTOM',
    colors: ['Mocha', 'Grey'],
    basePrice: 850,
    compareDelta: 120,
  },
  shoes: {
    nameEn: 'Daily Sneakers',
    nameTh: 'สนีกเกอร์ประจำวัน',
    descriptionEn: 'Minimal sneakers made to work with most everyday outfits.',
    descriptionTh: 'สนีกเกอร์ดีไซน์มินิมอลที่เข้ากับลุคประจำวันได้ง่าย',
    productType: 'ACCESSORY',
    colors: ['White', 'Black'],
    basePrice: 1290,
    compareDelta: 200,
  },
};

function deriveKeyword(groupKey, assetFile) {
  const basename = assetFile.replace(/\.[^.]+$/, '');
  if (basename === 'linen_shirt') {
    return 'linen_shirt';
  }

  const withPrefix = `${groupKey}-`;
  if (basename.startsWith(withPrefix)) {
    return basename.slice(withPrefix.length);
  }

  return basename;
}

function formatTimestamp(offsetDays, minutesOffset) {
  const baseDate = new Date(Date.UTC(2026, 2, 21, 9, 0, 0));
  baseDate.setUTCDate(baseDate.getUTCDate() + offsetDays);
  baseDate.setUTCMinutes(baseDate.getUTCMinutes() + minutesOffset);
  return baseDate.toISOString().slice(0, 19).replace('T', ' ');
}

function buildVariantSizes(groupConfig, productType) {
  if (productType === 'ACCESSORY') {
    return groupConfig.accessorySizes;
  }

  if (productType === 'BOTTOM') {
    return groupConfig.bottomSizes;
  }

  return groupConfig.topSizes;
}

function buildExpandedDemoProducts() {
  let productId = 1101;
  let productVariantId = 4101;
  let offsetDays = 0;
  const products = [];

  for (const [groupKey, assetFiles] of Object.entries(GROUP_ASSETS)) {
    const groupConfig = GROUPS[groupKey];

    assetFiles.forEach((assetFile, indexWithinGroup) => {
      const keyword = deriveKeyword(groupKey, assetFile);
      const meta = KEYWORD_META[keyword];

      if (!meta) {
        throw new Error(`Missing keyword metadata for ${assetFile} (${keyword})`);
      }

      const price = meta.basePrice + groupConfig.priceOffset + (indexWithinGroup * 20);
      const compareAtPrice = indexWithinGroup % 2 === 0
        ? price + meta.compareDelta
        : null;
      const sizes = buildVariantSizes(groupConfig, meta.productType);
      const skuBase = `${groupKey.slice(0, 3).toUpperCase()}-${keyword.toUpperCase().replace(/[^A-Z0-9]+/g, '')}-${productId}`;
      const createdAt = formatTimestamp(offsetDays, 0);
      const updatedAt = formatTimestamp(offsetDays, 25);

      products.push({
        productId,
        productType: meta.productType,
        categoryId: groupConfig.categoryId,
        assetFile,
        nameEn: `${groupConfig.labelEn} ${meta.nameEn}`,
        nameTh: `${meta.nameTh}${groupConfig.labelTh ? ` ${groupConfig.labelTh}` : ''}`,
        descriptionEn: `${meta.descriptionEn} Curated for the ${groupConfig.labelEn.toLowerCase()} storefront collection.`,
        descriptionTh: `${meta.descriptionTh} คัดเลือกสำหรับหมวด${groupConfig.labelTh}ของร้านค้า`,
        createdAt,
        updatedAt,
        variants: [
          {
            productVariantId: productVariantId++,
            skuCode: `${skuBase}-A`,
            colour: meta.colors[0],
            size: sizes[0],
            price,
            compareAtPrice,
            stockQty: 10 + (indexWithinGroup % 8) + 6,
            createdAt: formatTimestamp(offsetDays, 10),
            updatedAt: formatTimestamp(offsetDays, 10),
          },
          {
            productVariantId: productVariantId++,
            skuCode: `${skuBase}-B`,
            colour: meta.colors[1],
            size: sizes[1],
            price,
            compareAtPrice,
            stockQty: 8 + (indexWithinGroup % 7) + 5,
            createdAt: formatTimestamp(offsetDays, 12),
            updatedAt: formatTimestamp(offsetDays, 12),
          },
        ],
      });

      productId += 1;
      offsetDays += 1;
    });
  }

  return products;
}

const EXPANDED_DEMO_PRODUCTS = buildExpandedDemoProducts();

module.exports = {
  ADDITIONAL_TOP_LEVEL_CATEGORIES,
  EXISTING_TOP_LEVEL_ASSIGNMENTS,
  EXPANDED_DEMO_PRODUCTS,
};
