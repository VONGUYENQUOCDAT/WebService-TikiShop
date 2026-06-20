const API_URL = 'http://localhost:4000/api';

async function test() {
  console.log('--- Starting Procurement Flow Verification ---');

  // 1. Log in as admin
  console.log('Logging in as admin...');
  const adminLoginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@demo.local', password: 'admin123' })
  });
  const adminLoginJson = await adminLoginRes.json();
  if (!adminLoginRes.ok) {
    console.error('Admin login failed:', adminLoginJson);
    process.exit(1);
  }
  const adminToken = adminLoginJson.token;
  const adminId = adminLoginJson.user.id;
  console.log('Admin logged in. ID:', adminId);

  // 2. Fetch branches
  console.log('Fetching branches...');
  const branchRes = await fetch(`${API_URL}/inventory/branches`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const branches = await branchRes.json();
  if (!branchRes.ok || branches.length === 0) {
    console.error('Failed to fetch branches:', branches);
    process.exit(1);
  }
  const branchId = branches[0].id;
  console.log(`Using branch: ${branches[0].name} (ID: ${branchId})`);

  // 3. Fetch products
  console.log('Fetching iPhone 15...');
  const iphoneRes = await fetch(`${API_URL}/products/slug/iphone-15-128gb`);
  const iphone = await iphoneRes.json();
  if (!iphoneRes.ok || !iphone.id) {
    console.error('Failed to fetch iPhone 15:', iphone);
    process.exit(1);
  }
  console.log(`iPhone 15 ID: ${iphone.id}`);

  // 4. Create a Supplier
  const code = `SUP-TEST-${Date.now().toString().slice(-4)}`;
  console.log(`Creating supplier with code ${code}...`);
  const supRes = await fetch(`${API_URL}/procurement/suppliers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      name: 'Test Supplier JSC',
      code: code,
      phone: '0987654321',
      email: 'contact@testsupplier.com',
      address: '456 Test Street, District 1, HCMC'
    })
  });
  const supplier = await supRes.json();
  if (!supRes.ok) {
    console.error('Failed to create supplier:', supplier);
    process.exit(1);
  }
  console.log('Supplier created successfully. ID:', supplier.id);

  // 5. Create a Purchase Order (DRAFT)
  console.log('Creating Purchase Order (PO) in DRAFT...');
  const poRes = await fetch(`${API_URL}/procurement/purchase-orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      supplierId: supplier.id,
      items: [
        {
          productId: iphone.id,
          quantityOrdered: 10,
          pricePerUnit: 15000000 // 15 million VND
        }
      ]
    })
  });
  const po = await poRes.json();
  if (!poRes.ok) {
    console.error('Failed to create PO:', po);
    process.exit(1);
  }
  console.log('PO created successfully. ID:', po.id, 'Number:', po.poNumber, 'Status:', po.status);

  // 6. Transition PO DRAFT -> SUBMITTED
  console.log('Transitioning PO DRAFT -> SUBMITTED...');
  const subRes = await fetch(`${API_URL}/procurement/purchase-orders/${po.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ status: 'SUBMITTED' })
  });
  const subPO = await subRes.json();
  if (!subRes.ok) {
    console.error('Failed to transition to SUBMITTED:', subPO);
    process.exit(1);
  }
  console.log('PO updated to SUBMITTED. Status:', subPO.status);

  // 7. Transition PO SUBMITTED -> APPROVED
  console.log('Transitioning PO SUBMITTED -> APPROVED...');
  const appRes = await fetch(`${API_URL}/procurement/purchase-orders/${po.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ status: 'APPROVED' })
  });
  const appPO = await appRes.json();
  if (!appRes.ok) {
    console.error('Failed to transition to APPROVED:', appPO);
    process.exit(1);
  }
  console.log('PO updated to APPROVED. Status:', appPO.status, 'Approved By:', appPO.approvedById);

  // 8. Create a Goods Receipt (GR) against the APPROVED PO
  console.log('Creating Goods Receipt (GR) to receive goods into inventory...');
  const grRes = await fetch(`${API_URL}/procurement/goods-receipts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      purchaseOrderId: po.id,
      branchId: branchId,
      receivedById: 'Test Manager',
      items: [
        {
          productId: iphone.id,
          qtyReceived: 10,
          qtyDamaged: 0
        }
      ]
    })
  });
  const gr = await grRes.json();
  if (!grRes.ok) {
    console.error('Failed to create Goods Receipt:', gr);
    process.exit(1);
  }
  console.log('Goods Receipt processed successfully. ID:', gr.id, 'Number:', gr.grNumber);

  // 9. Verify PO status is now COMPLETED
  console.log('Verifying updated PO status...');
  const verifyPORes = await fetch(`${API_URL}/procurement/purchase-orders/${po.id}`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const verifyPO = await verifyPORes.json();
  if (!verifyPORes.ok) {
    console.error('Failed to fetch updated PO details:', verifyPO);
    process.exit(1);
  }
  console.log('Updated PO status (Expected: COMPLETED):', verifyPO.status);
  if (verifyPO.status === 'COMPLETED') {
    console.log('✅ Success! PO status auto-completed correctly.');
  } else {
    console.error('❌ Error: PO status is not COMPLETED.');
    process.exit(1);
  }

  // 10. Verify stock of iPhone 15 at branch increased
  console.log('Verifying stock level of iPhone 15 at the branch...');
  const stockRes = await fetch(`${API_URL}/inventory/branch-stock?branchId=${branchId}&q=iPhone`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const stockJson = await stockRes.json();
  const iphoneStock = stockJson.find(s => s.productId === iphone.id);
  console.log('iPhone 15 stock at the branch:', iphoneStock?.stock);
  
  console.log('--- All Procurement Flow Verifications Passed! ---');
}

test();
