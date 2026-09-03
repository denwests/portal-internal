import { useEffect, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "../supabase";
import Sidebar from "../components/Sidebar";
import TablePagination from "../components/TablePagination";
import { MonthPicker } from "../components/PeriodPicker";
import useTablePagination from "../hooks/useTablePagination";
import { summarizeCustomerFinance } from "../lib/customerFinance";
import { drawPdfFooter, drawPdfHeader, plunoTableTheme } from "../lib/pdfTheme";
import "./Customer.css";

/* =========================================================
   FORMAT RUPIAH
========================================================= */

function formatRupiah(value) {
  if (value === "" || value === null || value === undefined) {
    return "";
  }

  const number = Number(String(value).replace(/\D/g, ""));

  if (Number.isNaN(number)) {
    return "";
  }

  return `Rp ${number.toLocaleString("id-ID")}`;
}

function calculateMdr(amount, paymentMethod) {
  const gross = Number(amount || 0);
  const percentage = paymentMethod === "QRIS" && gross > 500000 ? 0.3 : 0;
  const mdrAmount = Math.round(gross * (percentage / 100));

  return {
    percentage,
    mdrAmount,
    netAmount: gross - mdrAmount,
  };
}

function formatCustomerStatus(status) {
  return ({ Selesai: "Complete", Proses: "In Progress", Batal: "Canceled" })[status] || status || "-";
}

/* =========================================================
   FORMAT DATE
========================================================= */

function formatDate(date) {
  if (!date) return "-";

  const [year, month, day] = date.split("-");

  const months = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  return `${day} ${months[Number(month) - 1]} ${year}`;
}

/* =========================================================
   GRAND TOTAL
========================================================= */

function getGrandTotal(customer) {
  if (customer.status === "Canceled") {
    return Number(customer.total || 0);
  }

  return (
    Number(customer.packagePrice || 0) +
    Number(customer.addon || 0)
  );
}

/* =========================================================
   DATABASE → APP
========================================================= */

function convertFromDatabase(customer) {
  const packagePrice = Number(customer.price || 0);
  const addon = Number(customer.addon || 0);
  const storedTotal = Number(customer.total || 0);
  const fallbackPackageValue =
    String(customer.status || "").toLowerCase() === "canceled"
      ? storedTotal
      : packagePrice + addon;

  return {
    id: customer.id,
    name: customer.name || "",
    phone: customer.phone || "",
    package: customer.package || "",
    date: customer.date || "",
    packagePrice,
    addon,
    addonNote: customer.addon_note || "",
    total: Number(customer.total || 0),
    status: customer.status || "Proses",
    createdAt: customer.created_at,
    totalPackageValue: Number(
      customer.total_package_value ?? fallbackPackageValue
    ),
    totalMdrValue: Number(customer.total_mdr_value || 0),
    totalNetValue: Number(
      customer.total_net_value ?? fallbackPackageValue
    ),
    linkedTransactionCount: Number(
      customer.linked_transaction_count || 0
    ),
    reconciliationDifference: Number(
      customer.reconciliation_difference || 0
    ),
    reconciliationStatus:
      customer.reconciliation_status || "not_calculated",
  };
}

/* =========================================================
   APP → DATABASE
========================================================= */

function convertToDatabase(customer) {
  return {
    name: customer.name,
    phone: customer.phone,
    package: customer.package,
    date: customer.date,
    price: Number(customer.packagePrice || 0),
    addon: Number(customer.addon || 0),
    addon_note: customer.addonNote || "",
    total: getGrandTotal(customer),
    status: customer.status,
  };
}

/* =========================================================
   CUSTOMER
========================================================= */

function Customer() {
  const employeeRole =
    localStorage.getItem("employeeRole") || "Staff";

  const canManageCustomer =
    employeeRole === "Founder" || employeeRole === "Administrator";

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [search, setSearch] = useState("");

  const [modalType, setModalType] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const [selectedMonth, setSelectedMonth] = useState(
    String(new Date().getMonth() + 1).padStart(2, "0")
  );

  const [selectedYear, setSelectedYear] = useState(
    String(new Date().getFullYear())
  );

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    package: "",
    date: "",
    packagePrice: "",
    addon: "",
    addonNote: "",
    addonPaymentMethod: "Cash",
    status: "Proses",
  });

  const monthNamesIndonesia = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  /* =========================================================
     LOAD DATA
  ========================================================= */

  const fetchCustomers = async () => {
    setLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .rpc("get_customer_finance_summary");

    if (error) {
      console.error("CUSTOMER FETCH ERROR:", error);

      setErrorMessage(
        `Gagal mengambil data customer: ${error.message}`
      );

      setCustomers([]);
      setLoading(false);
      return;
    }

    setCustomers((data || []).map(convertFromDatabase));
    setLoading(false);
  };

  useEffect(() => {
    // Initial data hydration is intentionally delegated to the async loader.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCustomers();
  }, []);

  const activeYear = selectedYear;

  /* =========================================================
     MONTH
  ========================================================= */

  const activeMonth = selectedMonth;

  /* =========================================================
     FILTER
  ========================================================= */

  const monthCustomers = customers.filter((customer) => {
    if (!customer.date) return false;

    return (
      customer.date.slice(0, 4) === activeYear &&
      customer.date.slice(5, 7) === activeMonth
    );
  });

  const filteredCustomers = monthCustomers.filter((customer) =>
    `${customer.name} ${customer.phone} ${customer.package}`
      .toLowerCase()
      .includes(search.toLowerCase().trim())
  );

  const customerPagination = useTablePagination(
    filteredCustomers,
    `${activeMonth}-${activeYear}-${search}`
  );

  const financeSummary = summarizeCustomerFinance(monthCustomers);
  const totalCustomer = financeSummary.customerCount;
  const totalRevenue = financeSummary.totalPackageValue;
  const totalNetRevenue = financeSummary.totalNetValue;

  /* =========================================================
     PDF
  ========================================================= */

  const handleDownloadPDF = () => {
    if (filteredCustomers.length === 0) {
      setErrorMessage(
        `Tidak ada customer untuk ${
          monthNamesIndonesia[Number(activeMonth) - 1]
        } ${activeYear}.`
      );
      return;
    }

    setErrorMessage("");

    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    drawPdfHeader(doc, {
      title: "Customer List",
      subtitle: `${monthNamesIndonesia[Number(activeMonth) - 1]} ${activeYear}`,
    });

    autoTable(doc, {
      startY: 44,
      head: [[
        "Customer",
        "Package",
        "Date",
        "Total Package Value",
        "Total Net Value",
        "Status",
      ]],
      body: filteredCustomers.map((customer) => [
        customer.name || "-",
        customer.package || "-",
        formatDate(customer.date),
        formatRupiah(customer.totalPackageValue),
        formatRupiah(customer.totalNetValue),
        formatCustomerStatus(customer.status),
      ]),
      ...plunoTableTheme(8),
    });

    drawPdfFooter(doc, "PLUNO STUDIO - CUSTOMER DATA");

    doc.save(`customers-${activeYear}-${activeMonth}.pdf`);
  };

  /* =========================================================
     EDIT
  ========================================================= */

  const openEditForm = async (customer) => {
    if (!canManageCustomer) return;

    let addonPaymentMethod = "Cash";

    const { data: addonTransaction } = await supabase
      .from("transactions")
      .select("payment_method")
      .eq("source_type", "customer_addon")
      .eq("source_key", String(customer.id))
      .maybeSingle();

    if (addonTransaction?.payment_method) {
      addonPaymentMethod = addonTransaction.payment_method;
    }

    setFormData({
      name: customer.name,
      phone: customer.phone,
      package: customer.package,
      date: customer.date,
      packagePrice: customer.packagePrice,
      addon: customer.addon,
      addonNote: customer.addonNote,
      addonPaymentMethod,
      status: customer.status,
    });

    setSelectedCustomer(customer);
    setErrorMessage("");
    setModalType("edit");
  };

  /* =========================================================
     DETAIL
  ========================================================= */

  const openDetail = (customer) => {
    setSelectedCustomer(customer);
    setModalType("detail");
  };

  /* =========================================================
     CLOSE
  ========================================================= */

  const closeModal = () => {
    setModalType(null);
    setSelectedCustomer(null);
  };

  /* =========================================================
     CHANGE
  ========================================================= */

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  /* =========================================================
     MONEY
  ========================================================= */

  const handleMoneyChange = (event) => {
    const { name, value } = event.target;

    const numericValue = value.replace(/\D/g, "");

    setFormData((current) => ({
      ...current,
      [name]: numericValue,
    }));
  };

  /* =========================================================
     ADD-ON → TRANSACTIONS
     Satu customer hanya memiliki satu transaksi add-on aktif.
  ========================================================= */

  const syncAddonTransaction = async (
    customer,
    addonAmount,
    paymentMethod,
    addonNote
  ) => {
    if (!customer?.id) return;

    const sourceKey = String(customer.id);

    const { data: existing, error: lookupError } = await supabase
      .from("transactions")
      .select("id, transaction_date, amount, payment_method, information")
      .eq("source_type", "customer_addon")
      .eq("source_key", sourceKey)
      .maybeSingle();

    if (lookupError) throw lookupError;

    if (Number(addonAmount || 0) <= 0) {
      if (existing?.id) {
        const { error: deleteError } = await supabase
          .from("transactions")
          .delete()
          .eq("id", existing.id);
        if (deleteError) throw deleteError;
      }
      return;
    }

    const method = paymentMethod === "QRIS" ? "QRIS" : "Cash";
    const mdr = calculateMdr(addonAmount, method);
    const cleanInformation =
      addonNote?.trim() || "Auto generated from Customer Data add-on";

    const addOnChanged =
      !existing ||
      Number(existing.amount || 0) !== Number(addonAmount || 0) ||
      String(existing.payment_method || "Cash") !== method ||
      String(existing.information || "") !== cleanInformation;

    const transactionDate =
      addOnChanged || !existing?.transaction_date
        ? new Date().toISOString().slice(0, 10)
        : existing.transaction_date;

    const payload = {
      transaction_date: transactionDate,
      revenue_date: customer.date || transactionDate,
      customer: customer.name || "",
      payment_type: "Add-on",
      description: `${customer.package || "Package"} · Add-on`,
      amount: Number(addonAmount || 0),
      payment_method: method,
      mdr_percentage: mdr.percentage,
      mdr_amount: mdr.mdrAmount,
      net_amount: mdr.netAmount,
      information: cleanInformation,
      booking_id: null,
      customer_id: sourceKey,
      source_type: "customer_addon",
      source_key: sourceKey,
    };

    if (existing?.id) {
      const { error: updateError } = await supabase
        .from("transactions")
        .update(payload)
        .eq("id", existing.id);
      if (updateError) throw updateError;
      return;
    }

    const { error: insertError } = await supabase
      .from("transactions")
      .insert([payload]);
    if (insertError) throw insertError;
  };

  /* =========================================================
     SUBMIT
  ========================================================= */

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!canManageCustomer) {
      setErrorMessage("Staff hanya memiliki akses View pada Customer Data.");
      return;
    }

    setErrorMessage("");

    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError || !sessionData?.session) {
      setErrorMessage(
        "Sesi login Supabase tidak ditemukan. Silakan login kembali."
      );
      return;
    }

    if (modalType !== "edit" || !selectedCustomer) {
      setErrorMessage(
        "Customer baru harus dibuat melalui Booking."
      );
      return;
    }

    const customerData = {
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      package: formData.package,
      date: formData.date,
      packagePrice: Number(formData.packagePrice || 0),
      addon: Number(formData.addon || 0),
      addonNote: formData.addonNote,
      status: formData.status,
      total: Number(selectedCustomer.total || 0),
    };

    /* =====================================================
       EDIT
    ===================================================== */

    const { data, error } = await supabase
      .from("customers")
      .update(convertToDatabase(customerData))
      .eq("id", selectedCustomer.id)
      .select()
      .single();

    if (error) {
      console.error("UPDATE CUSTOMER ERROR:", error);

      setErrorMessage(
        `Gagal memperbarui customer: ${error.message}`
      );
      return;
    }

    const updatedCustomer = convertFromDatabase(data);

    try {
      await syncAddonTransaction(
        updatedCustomer,
        Number(formData.addon || 0),
        formData.addonPaymentMethod,
        formData.addonNote
      );
    } catch (transactionError) {
      console.error("ADD-ON TRANSACTION SYNC ERROR:", transactionError);

      await supabase
        .from("customers")
        .update(convertToDatabase(selectedCustomer))
        .eq("id", selectedCustomer.id);

      setErrorMessage(
        `Customer tidak disimpan karena transaksi add-on gagal: ${transactionError.message}`
      );
      return;
    }

    await fetchCustomers();

    if (updatedCustomer.date) {
      setSelectedYear(updatedCustomer.date.slice(0, 4));
      setSelectedMonth(updatedCustomer.date.slice(5, 7));
    }

    closeModal();
  };

  /* =========================================================
     DELETE
  ========================================================= */

  const deleteCustomer = async (customer) => {
    if (!canManageCustomer) return;

    const confirmed = window.confirm(
      `Hapus customer "${customer.name}"?`
    );

    if (!confirmed) return;

    setErrorMessage("");

    const { error: addonDeleteError } = await supabase
      .from("transactions")
      .delete()
      .eq("source_type", "customer_addon")
      .eq("source_key", String(customer.id));

    if (addonDeleteError) {
      setErrorMessage(
        `Gagal menghapus transaksi add-on: ${addonDeleteError.message}`
      );
      return;
    }

    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", customer.id);

    if (error) {
      console.error("DELETE CUSTOMER ERROR:", error);

      setErrorMessage(
        `Gagal menghapus customer: ${error.message}`
      );
      return;
    }

    setCustomers((current) =>
      current.filter((item) => item.id !== customer.id)
    );

    closeModal();
  };

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="customer-page">
      <Sidebar activePage="customer" />

      <main className="customer-main">
        {/* OVERVIEW */}

        <div className="customer-section-heading">
          <div>
            <div className="customer-section-label">
              PLUNO STUDIO / CUSTOMER DATABASE
            </div>

            <h2>Customer Performance</h2>
          </div>

          <div className="customer-performance-filter">
            <MonthPicker
              year={activeYear}
              month={activeMonth}
              ariaLabel="Customer month and year"
              onChange={({ year, month }) => {
                setSelectedYear(String(year));
                setSelectedMonth(String(month).padStart(2, "0"));
              }}
            />
          </div>
        </div>

        {errorMessage && (
          <div className="customer-error">
            {errorMessage}
          </div>
        )}

        {/* STATISTICS */}

        <section className="customer-stat-grid">
          <div className="customer-stat-card">
            <div className="customer-stat-label">
              CUSTOMERS
            </div>

            <div className="customer-stat-value">
              {loading ? "..." : totalCustomer}
            </div>

            <div className="customer-stat-note">
              {monthNamesIndonesia[
                Number(activeMonth) - 1
              ] || "-"}{" "}
              {activeYear}
            </div>
          </div>

          <div className="customer-stat-card revenue">
            <div className="customer-stat-label">
              TOTAL PACKAGE VALUE
            </div>

            <div className="customer-stat-value">
              {loading ? "..." : formatRupiah(totalRevenue)}
            </div>

            <div className="customer-stat-note">
              Nilai final customer bulan ini
            </div>
          </div>

          <div className="customer-stat-card revenue net">
            <div className="customer-stat-label">
              TOTAL NET VALUE
            </div>

            <div className="customer-stat-value">
              {loading ? "..." : formatRupiah(totalNetRevenue)}
            </div>

            <div className="customer-stat-note">
              Setelah MDR transaksi terkait
            </div>
          </div>
        </section>

        {/* CUSTOMER LIST */}

        <section className="customer-list-section">
          <div className="customer-list-header">
            <div>
              <div className="customer-eyebrow">
                CUSTOMER DATABASE
              </div>

              <h2>Customer List</h2>
            </div>

            <div className="customer-list-right">
              <span>
                {filteredCustomers.length} CUSTOMER
              </span>

              <div className="search-box">
                <span>/</span>

                <input
                  type="text"
                  placeholder="Search customer..."
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                />
              </div>

              {canManageCustomer && (
                <div className="customer-header-actions">
                  <button
                    type="button"
                    className="customer-pdf-button"
                    onClick={handleDownloadPDF}
                    disabled={loading || filteredCustomers.length === 0}
                    title={
                      filteredCustomers.length === 0
                        ? "Tidak ada data untuk diekspor"
                        : "Download customer PDF"
                    }
                  >
                    Download PDF
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="customer-table-scroll">
            <table className="customer-table">
              <thead>
                <tr>
                  <th>CUSTOMER</th>
                  <th>TOTAL PACKAGE VALUE</th>
                  <th>TOTAL NET VALUE</th>
                  <th>DATE</th>
                  <th>STATUS</th>
                  <th>ACTION</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan="6"
                      className="empty-customer table-empty-cell"
                    >
                      <span className="table-empty-viewport">
                        Loading customer...
                      </span>
                    </td>
                  </tr>
                ) : filteredCustomers.length === 0 ? (
                  <tr>
                    <td
                      colSpan="6"
                      className="empty-customer table-empty-cell"
                    >
                      <span className="table-empty-viewport">
                        Tidak ada customer pada{" "}
                        {monthNamesIndonesia[
                          Number(activeMonth) - 1
                        ] || "-"}{" "}
                        {activeYear}.
                      </span>
                    </td>
                  </tr>
                ) : (
                  customerPagination.visibleItems.map((customer) => (
                    <tr key={customer.id}>
                      <td>
                        <div className="customer-name">
                          {customer.name}
                        </div>

                        <div className="customer-contact">
                          {customer.package || "-"} · {customer.phone}
                        </div>
                      </td>

                      <td className="customer-total">
                        {formatRupiah(customer.totalPackageValue)}
                      </td>

                      <td className="customer-total customer-net-value">
                        {formatRupiah(customer.totalNetValue)}
                        {customer.reconciliationStatus === "needs_review" && (
                          <span className="customer-finance-warning">
                            Check link
                          </span>
                        )}
                      </td>

                      <td className="customer-date">
                        {formatDate(customer.date)}
                      </td>

                      <td>
                        <span
                          className={`customer-status ${
                            customer.status === "Canceled"
                              ? "status-canceled"
                              : customer.status === "Selesai"
                              ? "status-done"
                              : "status-process"
                          }`}
                        >
                          {formatCustomerStatus(customer.status)}
                        </span>
                      </td>

                      <td>
                        <div className="customer-actions">
                          <button
                            type="button"
                            onClick={() =>
                              openDetail(customer)
                            }
                          >
                            View
                          </button>

                          {canManageCustomer && (
                            <button
                              type="button"
                              onClick={() =>
                                openEditForm(customer)
                              }
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <TablePagination
            currentPage={customerPagination.currentPage}
            totalPages={customerPagination.totalPages}
            onPageChange={customerPagination.setCurrentPage}
            label="customer"
          />
        </section>

        <footer className="customer-footer">
          <span>PLUNO INTERNAL SYSTEM</span>
          <span>v1.0 · 2026</span>
        </footer>
      </main>

      {/* EDIT */}

      {modalType === "edit" && selectedCustomer && (
        <div className="customer-overlay">
          <div className="customer-form-box">
            <div className="customer-form-header">
              <div>
                <div className="customer-form-kicker">
                  EDIT CUSTOMER
                </div>

                <h2>Edit Customer</h2>

                <p>Perbarui informasi customer.</p>
              </div>

              <button
                type="button"
                className="form-close"
                onClick={closeModal}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="customer-form-grid">
                <div className="customer-field">
                  <label>FULL NAME</label>

                  <input
                    type="text"
                    name="name"
                    placeholder="Customer name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="customer-field">
                  <label>PHONE NUMBER</label>

                  <input
                    type="text"
                    name="phone"
                    placeholder="08xxxxxxxxxx"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="customer-field">
                  <label>PACKAGE</label>

                  <input
                    type="text"
                    name="package"
                    placeholder="Package name"
                    value={formData.package}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="customer-field">
                  <label>SESSION DATE</label>

                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="customer-field">
                  <label>PACKAGE PRICE</label>

                  <input
                    type="text"
                    name="packagePrice"
                    inputMode="numeric"
                    placeholder="Rp 0"
                    value={formatRupiah(
                      formData.packagePrice
                    )}
                    onChange={handleMoneyChange}
                    required
                  />
                </div>

                <div className="customer-field">
                  <label>STATUS</label>

                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                  >
                    <option value="Proses">
                      In Progress
                    </option>

                    <option value="Selesai">
                      Complete
                    </option>

                    <option value="Canceled">
                      Canceled
                    </option>
                  </select>
                </div>

                <div className="addon-section">
                  <div className="addon-header">
                    <div>
                      <div className="addon-label">
                        ADD-ON
                      </div>

                      <p>
                        Tambahan biaya di luar paket utama.
                      </p>
                    </div>
                  </div>

                  <div className="addon-grid">
                    <div className="customer-field">
                      <label>ADD-ON AMOUNT</label>

                      <input
                        type="text"
                        name="addon"
                        inputMode="numeric"
                        placeholder="Rp 0"
                        value={formatRupiah(
                          formData.addon
                        )}
                        onChange={handleMoneyChange}
                      />
                    </div>

                    <div className="customer-field">
                      <label>ADD-ON PAYMENT METHOD</label>

                      <select
                        name="addonPaymentMethod"
                        value={formData.addonPaymentMethod}
                        onChange={handleChange}
                      >
                        <option value="Cash">Cash</option>
                        <option value="QRIS">QRIS</option>
                      </select>
                    </div>

                    <div className="customer-field">
                      <label>
                        ADD-ON INFORMATION
                      </label>

                      <input
                        type="text"
                        name="addonNote"
                        placeholder="Example: Additional 5 photos"
                        value={formData.addonNote}
                        onChange={handleChange}
                      />
                    </div>
                  </div>

                  <div className="addon-total">
                    <span>GRAND TOTAL</span>

                    <strong>
                      {formatRupiah(
                        Number(
                          formData.packagePrice || 0
                        ) +
                          Number(formData.addon || 0)
                      )}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="customer-form-footer">
                <button
                  type="button"
                  className="delete-button"
                  onClick={() =>
                    deleteCustomer(
                      selectedCustomer
                    )
                  }
                >
                  Delete
                </button>

                <div className="form-footer-right">
                  <button
                    type="button"
                    className="customer-cancel"
                    onClick={closeModal}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="customer-save"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL */}

      {modalType === "detail" && selectedCustomer && (
        <div className="customer-overlay">
          <div className="customer-detail-box">
            <div className="customer-form-header">
              <div>
                <div className="customer-form-kicker">
                  CUSTOMER PROFILE
                </div>

                <h2>{selectedCustomer.name}</h2>

                <p>Customer information.</p>
              </div>

              <button
                type="button"
                className="form-close"
                onClick={closeModal}
              >
                ×
              </button>
            </div>

            <div className="detail-grid">
              <div className="detail-item">
                <span>NAME</span>

                <strong>
                  {selectedCustomer.name}
                </strong>
              </div>

              <div className="detail-item">
                <span>PHONE NUMBER</span>

                <strong>
                  {selectedCustomer.phone}
                </strong>
              </div>

              <div className="detail-item">
                <span>PACKAGE</span>

                <strong>
                  {selectedCustomer.package}
                </strong>
              </div>

              <div className="detail-item">
                <span>SESSION DATE</span>

                <strong>
                  {formatDate(
                    selectedCustomer.date
                  )}
                </strong>
              </div>

              <div className="detail-item">
                <span>PACKAGE PRICE</span>

                <strong>
                  {formatRupiah(selectedCustomer.packagePrice)}
                </strong>
              </div>

              <div className="detail-item">
                <span>ADD-ON</span>

                <strong>
                  {formatRupiah(selectedCustomer.addon)}
                </strong>
              </div>

              <div className="detail-item detail-wide">
                <span>ADD-ON INFORMATION</span>

                <strong>
                  {selectedCustomer.addonNote || "-"}
                </strong>
              </div>

              <div className="detail-item">
                <span>TOTAL PACKAGE VALUE</span>

                <strong>
                  {formatRupiah(selectedCustomer.totalPackageValue)}
                </strong>
              </div>

              <div className="detail-item">
                <span>TOTAL MDR</span>

                <strong>
                  {formatRupiah(selectedCustomer.totalMdrValue)}
                </strong>
              </div>

              <div className="detail-item">
                <span>TOTAL NET VALUE</span>

                <strong>
                  {formatRupiah(selectedCustomer.totalNetValue)}
                </strong>
              </div>

              <div className="detail-item">
                <span>STATUS</span>

                <strong>
                  {formatCustomerStatus(selectedCustomer.status)}
                </strong>
              </div>
            </div>

            <div className="detail-footer">
              <button
                type="button"
                className="customer-cancel"
                onClick={closeModal}
              >
                Close
              </button>

              {canManageCustomer && (
                <button
                  type="button"
                  className="customer-save"
                  onClick={() =>
                    openEditForm(selectedCustomer)
                  }
                >
                  Edit Customer
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PRINT */}

      <div className="customer-print-template">
        <div className="print-header">
          <div>
            <div className="print-brand">PLUNO</div>

            <div className="print-subbrand">
              STUDIO
            </div>
          </div>

          <div className="print-title">
            CUSTOMER DATA
          </div>
        </div>

        <div className="print-rule" />

        <div className="print-meta">
          <div>
            <span>PERIOD</span>

            <strong>
              {monthNamesIndonesia[
                Number(activeMonth) - 1
              ] || "-"}{" "}
              {activeYear}
            </strong>
          </div>

          <div>
            <span>TOTAL CUSTOMER</span>

            <strong>
              {monthCustomers.length}
            </strong>
          </div>

          <div>
            <span>TOTAL PACKAGE VALUE</span>

            <strong>
              {formatRupiah(totalRevenue)}
            </strong>
          </div>

          <div>
            <span>TOTAL NET VALUE</span>

            <strong>
              {formatRupiah(totalNetRevenue)}
            </strong>
          </div>
        </div>

        <table className="print-table">
          <thead>
            <tr>
              <th>NO</th>
              <th>CUSTOMER</th>
              <th>PHONE</th>
              <th>PACKAGE</th>
              <th>SESSION DATE</th>
              <th>PACKAGE VALUE</th>
              <th>NET VALUE</th>
              <th>STATUS</th>
            </tr>
          </thead>

          <tbody>
            {monthCustomers.map((customer, index) => (
              <tr key={customer.id}>
                <td>{index + 1}</td>

                <td>{customer.name}</td>

                <td>{customer.phone}</td>

                <td>
                  {customer.package || "-"}
                </td>

                <td>
                  {formatDate(customer.date)}
                </td>

                <td>
                  {formatRupiah(
                    customer.totalPackageValue
                  )}
                </td>

                <td>
                  {formatRupiah(customer.totalNetValue)}
                </td>

                <td>{formatCustomerStatus(customer.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="print-footer">
          <span>PLUNO INTERNAL SYSTEM</span>

          <span>
            Generated from Customer Data
          </span>
        </div>
      </div>
    </div>
  );
}

export default Customer;
