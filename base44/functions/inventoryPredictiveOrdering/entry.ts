import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get all drugs in inventory
    const drugs = await base44.asServiceRole.entities.Drug.list("", 500);

    // Get all prescriptions and dispensing from last 30 days
    const prescriptions = await base44.asServiceRole.entities.Prescription.filter({}, "-created_date", 1000);
    const dispensing = await base44.asServiceRole.entities.PharmacyDispensing.filter({}, "-created_date", 1000);

    const reorderCandidates = [];

    for (const drug of drugs) {
      // Calculate 30-day consumption
      const drugPrescriptions = prescriptions.filter(p => p.drug_name === drug.name);
      const drugDispensing = dispensing.filter(d => d.item_name === drug.name);
      
      const totalDispensed = drugDispensing.reduce((sum, d) => sum + (d.quantity_dispensed || 0), 0);
      const dailyUsage = totalDispensed / 30;
      const daysUntilStockout = drug.quantity_in_stock / (dailyUsage || 1);

      // If stock runs out in < 14 days and below reorder level
      if (daysUntilStockout < 14 && drug.quantity_in_stock <= drug.reorder_level) {
        const orderQuantity = (drug.reorder_level * 3) - drug.quantity_in_stock;
        
        reorderCandidates.push({
          drug_id: drug.id,
          drug_name: drug.name,
          current_stock: drug.quantity_in_stock,
          daily_usage: dailyUsage.toFixed(2),
          days_until_stockout: Math.round(daysUntilStockout),
          recommended_order_qty: Math.round(orderQuantity),
          unit_cost: drug.unit_cost || 0,
          total_cost: Math.round(orderQuantity * (drug.unit_cost || 0)),
        });
      }
    }

    // Auto-create purchase orders for critical items
    let ordersCreated = 0;
    for (const candidate of reorderCandidates.slice(0, 10)) {
      // Check if PO already exists for this drug
      const existingPO = await base44.asServiceRole.entities.PharmacyPurchaseOrder.filter(
        { drug_name: candidate.drug_name, status: { $in: ["pending", "ordered"] } },
        "",
        1
      );

      if (existingPO.length === 0) {
        await base44.asServiceRole.entities.PharmacyPurchaseOrder.create({
          drug_name: candidate.drug_name,
          quantity_ordered: candidate.recommended_order_qty,
          unit_cost: candidate.unit_cost,
          total_cost: candidate.total_cost,
          status: "pending",
          order_date: new Date().toISOString(),
          expected_delivery_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          priority: candidate.days_until_stockout < 7 ? "urgent" : "normal",
        });
        ordersCreated++;
      }
    }

    // Notify pharmacy manager
    if (reorderCandidates.length > 0) {
      await base44.asServiceRole.entities.Notification.create({
        title: `📦 Inventory Alert: ${reorderCandidates.length} Items Low`,
        message: `${ordersCreated} purchase orders auto-created. Critical items: ${reorderCandidates.slice(0, 3).map(c => c.drug_name).join(", ")}`,
        is_read: false,
        target_role: "pharmacist",
        priority: "high",
      });
    }

    return Response.json({
      status: "success",
      low_stock_items: reorderCandidates.length,
      orders_created: ordersCreated,
      candidates: reorderCandidates.slice(0, 5),
    });

  } catch (error) {
    console.error("Error predicting inventory:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});