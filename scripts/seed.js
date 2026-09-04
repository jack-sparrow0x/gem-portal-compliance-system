require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

async function seed() {
  console.log('🌱 Seeding Supabase database with clean test accounts and data...\n');

  // 1. Helper to clean and recreate user
  async function seedUser(email, password, fullName, role, organization) {
    const { data: usersData } = await supabase.auth.admin.listUsers();
    const existing = usersData?.users?.find((u) => u.email === email);
    if (existing) {
      console.log(`Deleting existing user: ${email}...`);
      await supabase.auth.admin.deleteUser(existing.id);
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role,
        organization,
      },
    });

    if (error) {
      console.error(`Failed to create ${email}:`, error);
      return null;
    }
    console.log(`✅ Created ${role.toUpperCase()} account: ${email} (${data.user.id})`);
    return data.user;
  }

  // Create Users
  const officer = await seedUser('officer@gem.gov.in', 'Password123!', 'Dr. Rajesh Kumar', 'officer', 'Ministry of Commerce & Industry (GeM)');
  const bidder1 = await seedUser('bidder@acme.com', 'Password123!', 'Suresh Sharma', 'bidder', 'Acme Enterprises Private Limited');
  const bidder2 = await seedUser('bidder@techsolutions.in', 'Password123!', 'Priya Patel', 'bidder', 'Tech Solutions India Pvt Ltd');

  if (!officer || !bidder1 || !bidder2) {
    console.error('User creation failed, stopping seed.');
    return;
  }

  // 2. Seed Mock Government Verification Records
  console.log('\n🏛️ Seeding mock government verification records...');
  await supabase.from('mock_gov_records').upsert([
    { id_type: 'GSTIN', id_value: '07AAAAA0000A1Z5', legal_name: 'Acme Enterprises Private Limited', status: 'Active', registration_date: '2018-04-01' },
    { id_type: 'GSTIN', id_value: '27BBBBB1111B2Z6', legal_name: 'Tech Solutions India Pvt Ltd', status: 'Suspended', registration_date: '2019-06-15' },
    { id_type: 'PAN', id_value: 'AAAAA0000A', legal_name: 'Acme Enterprises Private Limited', status: 'Active', registration_date: '2015-08-12' },
    { id_type: 'PAN', id_value: 'BBBBB1111B', legal_name: 'Tech Solutions India Pvt Ltd', status: 'Active', registration_date: '2016-05-30' },
    { id_type: 'UDYAM', id_value: 'UDYAM-DL-01-0001234', legal_name: 'Acme Enterprises Private Limited', status: 'Active', registration_date: '2020-07-01' },
    { id_type: 'UDYAM', id_value: 'UDYAM-MH-02-0005678', legal_name: 'Tech Solutions India Pvt Ltd', status: 'Expired', registration_date: '2021-02-14' },
  ], { onConflict: 'id_type,id_value' });

  // 3. Seed Tenders
  console.log('📋 Seeding active tenders...');
  const { data: tenders } = await supabase.from('tenders').upsert([
    {
      tender_number: 'GEM/2025/B/9823401',
      title: 'Procurement of High-Performance Laptops & Desktop Workstations',
      department: 'Ministry of Electronics & IT',
      description: 'Supply, installation, and 3-year warranty for 500 laptops and 200 workstations for Central Ministries across New Delhi.',
      required_docs: ['GST_CERTIFICATE', 'PAN_CARD', 'UDYAM_CERTIFICATE', 'FINANCIAL_STATEMENT'],
      mandatory_criteria: [
        { category: 'GST_CERTIFICATE', requirement: 'Must have an Active GSTIN registration in Delhi NCR or relevant state.' },
        { category: 'PAN_CARD', requirement: 'Valid Company PAN matching bidder legal name.' },
        { category: 'UDYAM_CERTIFICATE', requirement: 'Valid MSME/Udyam Certificate for Class I/II Local Supplier preference.' },
        { category: 'FINANCIAL_STATEMENT', requirement: 'Minimum average annual turnover of Rs. 1.5 Crores for the last 3 financial years.' }
      ],
      closing_date: new Date(Date.now() + 15 * 86400000).toISOString(),
      created_by: officer.id,
      is_active: true,
    },
    {
      tender_number: 'GEM/2025/B/9824105',
      title: 'Supply, Installation & Maintenance of 100 kW Solar Rooftop System',
      department: 'Ministry of New & Renewable Energy',
      description: 'Turnkey contract for design, supply, testing, and 5-year comprehensive AMC of 100 kW Grid-Connected Solar Rooftop PV System.',
      required_docs: ['GST_CERTIFICATE', 'PAN_CARD', 'FINANCIAL_STATEMENT'],
      mandatory_criteria: [
        { category: 'GST_CERTIFICATE', requirement: 'Active GSTIN registration.' },
        { category: 'PAN_CARD', requirement: 'Company PAN card.' },
      ],
      closing_date: new Date(Date.now() + 30 * 86400000).toISOString(),
      created_by: officer.id,
      is_active: true,
    }
  ], { onConflict: 'tender_number' }).select();

  const tender1 = tenders?.find(t => t.tender_number === 'GEM/2025/B/9823401');

  if (tender1) {
    // 4. Seed Bids
    console.log('📩 Seeding sample bid submission...');
    const { data: bidData } = await supabase.from('bids').upsert([
      {
        tender_id: tender1.id,
        bidder_id: bidder1.id,
        status: 'REPORT_READY',
        officer_remarks: 'Documents uploaded and auto-verified.',
      }
    ], { onConflict: 'tender_id,bidder_id' }).select();

    const bid1 = bidData?.[0];

    if (bid1) {
      // 5. Seed Documents
      console.log('📄 Seeding bid documents...');
      await supabase.from('bid_documents').insert([
        {
          bid_id: bid1.id,
          category: 'GST_CERTIFICATE',
          file_name: 'Acme_GST_Registration_Certificate.pdf',
          s3_key: 'demo/acme_gst.pdf',
          s3_bucket: 'gem-bid-compliance-docs',
          raw_ocr_text: 'GOVERNMENT OF INDIA - GOODS AND SERVICES TAX REGISTRATION CERTIFICATE. GSTIN: 07AAAAA0000A1Z5. Legal Name: Acme Enterprises Private Limited. Status: Active. Date of Issue: 01/04/2018.',
          extracted_json: {
            document_category: 'GST_CERTIFICATE',
            legal_name: 'Acme Enterprises Private Limited',
            identification_number: '07AAAAA0000A1Z5',
            issue_date: '2018-04-01',
            confidence_score: 0.98,
          },
        },
        {
          bid_id: bid1.id,
          category: 'PAN_CARD',
          file_name: 'Acme_Company_PAN.pdf',
          s3_key: 'demo/acme_pan.pdf',
          s3_bucket: 'gem-bid-compliance-docs',
          raw_ocr_text: 'INCOME TAX DEPARTMENT - GOVT OF INDIA. Permanent Account Number: AAAAA0000A. Name: Acme Enterprises Private Limited. Date of Incorporation: 12/08/2015.',
          extracted_json: {
            document_category: 'PAN_CARD',
            legal_name: 'Acme Enterprises Private Limited',
            identification_number: 'AAAAA0000A',
            issue_date: '2015-08-12',
            confidence_score: 0.99,
          },
        }
      ]);

      // 6. Seed Compliance Report
      console.log('📊 Seeding compliance report...');
      await supabase.from('compliance_reports').upsert([
        {
          bid_id: bid1.id,
          overall_score: 0.92,
          risk: 'LOW',
          mandatory_passed: true,
          flags: [
            { category: 'GST_CERTIFICATE', field: 'Legal Name', pdf_value: 'Acme Enterprises Private Limited', gov_value: 'Acme Enterprises Private Limited', severity: 'LOW', explanation: 'Legal name matches official GST database record exactly.' }
          ],
          reasoning_trace: [
            { step_number: 1, check_name: 'GSTIN Legal Name Matching', finding: 'Extracted name Acme Enterprises Private Limited matches Gov GSTIN database record exactly.', passed: true },
            { step_number: 2, check_name: 'GSTIN Active Status Check', finding: 'GSTIN 07AAAAA0000A1Z5 status is ACTIVE in Government portal.', passed: true }
          ]
        }
      ], { onConflict: 'bid_id' });
    }
  }

  console.log('\n🎉 SEED COMPLETED SUCCESSFULLY!');
  console.log('----------------------------------------------------');
  console.log('Officer Login: officer@gem.gov.in / Password123!');
  console.log('Bidder Login:  bidder@acme.com / Password123!');
  console.log('----------------------------------------------------');
}

seed().catch(console.error);
