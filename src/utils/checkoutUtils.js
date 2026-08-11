/**
 * Calculates the order summary for the checkout process.
 * 
 * @param {Array} cartItems - Array of product items in the cart
 * @param {Number} discount - The discount amount applied to the cart
 * @returns {Object} Calculated totals containing productTotal, shippingCharge, totalGST, discount, and finalPayable
 */
export const calculateOrderSummary = (cartItems, discount = 0) => {
  // 1. Product Total
  const productTotal = cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  
  // 2. Shipping Charge (Forced to FREE for SIH Prototype)
  const shippingCharge = 0;
  
  // 3. GST Calculation (Product by Product)
  const totalGST = cartItems.reduce((acc, item) => {
    // If gst_rate is undefined/null in the DB, default to 0
    const rate = parseFloat(item.gst_rate) || 0;
    
    // GST = (Price x Quantity x GST Rate) / 100
    const itemGST = (item.price * item.quantity * rate) / 100;
    
    return acc + itemGST;
  }, 0);

  // 4. Final Payable Amount
  const finalPayable = Math.max(0, productTotal + shippingCharge + totalGST - discount);

  return {
    productTotal,
    shippingCharge,
    totalGST,
    discount,
    finalPayable
  };
};
