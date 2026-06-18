import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Fetch all drugs and check stock levels
    const drugs = await base44.asServiceRole.entities.Drug.list("", 500);
    const createdRequisitions = [];

    for (const drug of drugs) {
      // Skip if stock is above minimum or no reorder level defined
      if (!drug.reorder_level || drug.quantity_in_stock > drug.reorder_level) {
        continue;
      }

      // Check if draft requisition already exists for this drug
      const existing = await base44.asServiceRole.entities.PharmacyRequisition.filter(
        { drug_id: drug.id, status: "draft" },
        "",
        1
      );

      if (existing.length > 0) {
        continue; // Draft already exists
      }

      // Calculate reorder quantity (default: 3x safety stock days worth)
      const safetyStockDays = drug.safety_stock_days || 7;
      const leadTimeDays = drug.lead_time_days || 30;
      const seasonalityMultiplier = drug.seasonality_multiplier || 1.0;
      
      // Formula: (Safety stock + Lead time stock) * Seasonality
      const reorderQty = Math.ceil(
        (safetyStockDays + leadTimeDays) * seasonalityMultiplier
      );

      // Create draft requisition
      const requisition = await base44.asServiceRole.entities.PharmacyRequisition.create({
        drug_id: drug.id,
        drug_name: drug.name,
        current_stock: drug.quantity_in_stock,
        minimum_level: drug.reorder_level,
        reorder_quantity: reorderQty,
        unit_cost: drug.unit_price || 0,
        total_cost: (drug.unit_price || 0) * reorderQty,
        status: "draft",
        notes: `Auto-generated: Stock fell below ${drug.reorder_level} units`,
      });

      createdRequisitions.push({
        drug: drug.name,
        requisitionId: requisition.id,
        quantity: reorderQty,
        cost: (drug.unit_price || 0) * reorderQty,
      });
    }

    return Response.json({
      status: "ok",
      requisitions_created: createdRequisitions.length,
      details: createdRequisitions,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});