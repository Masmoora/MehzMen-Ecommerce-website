export const calculateDiscount = (price, offer) => {
  if (!offer) return 0;

  if (offer.discountType === 'percentage') {
    return (price * offer.discountValue) / 100;
  }

  if (offer.discountType === 'fixed') {
    return offer.discountValue;
  }

  return 0;
};

export const getBestOffer = (price, productOffer, categoryOffer) => {
  const productDiscount = calculateDiscount(price, productOffer);
  const categoryDiscount = calculateDiscount(price, categoryOffer);

  let bestDiscount = 0;
  let appliedOfferType = null;

  if (productDiscount >= categoryDiscount) {
    bestDiscount = productDiscount;
    appliedOfferType = productDiscount > 0 ? 'PRODUCT' : null;
  } else {
    bestDiscount = categoryDiscount;
    appliedOfferType = categoryDiscount > 0 ? 'CATEGORY' : null;
  }

  if (bestDiscount > price) bestDiscount = price;

  const finalPrice = Math.max(0, price - bestDiscount);

  return {
    originalPrice: price,
    finalPrice,
    discountAmount: bestDiscount,
    appliedOfferType
  };
};