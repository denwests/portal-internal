import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import Sidebar from "../components/Sidebar";
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
  return {
    id: customer.id,
    name: customer.name || "",
    phone: customer.phone || "",
    package: customer.package || "",
    date: customer.date || "",
    packagePrice: Number(customer.price || 0),
    addon: Number(customer.addon || 0),
    addonNote: customer.addon_note || "",
    total: Number(customer.total || 0),
    status: customer.status || "Proses",
    createdAt: customer.created_at,
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
    status: "Proses",
  });

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

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
      .from("customers")
      .select("*")
      .order("date", {
        ascending: false,
      });

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
    fetchCustomers();
  }, []);

  /* =========================================================
     YEAR
  ========================================================= */

  const customerYears = [
    ...new Set(
      customers
        .filter((customer) => customer.date)
        .map((customer) => customer.date.slice(0, 4))
    ),
  ].sort().reverse();

  const activeYear = customerYears.includes(selectedYear)
    ? selectedYear
    : customerYears[0] || selectedYear;

  /* =========================================================
     MONTH
  ========================================================= */

  const customerMonths = [
    ...new Set(
      customers
        .filter(
          (customer) =>
            customer.date &&
            customer.date.slice(0, 4) === activeYear
        )
        .map((customer) => customer.date.slice(5, 7))
    ),
  ].sort();

  useEffect(() => {
    if (
      customerMonths.length > 0 &&
      !customerMonths.includes(selectedMonth)
    ) {
      setSelectedMonth(customerMonths[0]);
    }
  }, [activeYear, customerMonths.join(",")]);

  const activeMonth = customerMonths.includes(selectedMonth)
    ? selectedMonth
    : customerMonths[0] || selectedMonth;

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

  const totalCustomer = monthCustomers.length;

  const totalRevenue = monthCustomers.reduce(
    (total, customer) => total + getGrandTotal(customer),
    0
  );

  /* =========================================================
     PDF
  ========================================================= */

  const handleDownloadPDF = () => {
    window.print();
  };

  /* =========================================================
     ADD
  ========================================================= */

  const openAddForm = () => {
    setFormData({
      name: "",
      phone: "",
      package: "",
      date: "",
      packagePrice: "",
      addon: "",
      addonNote: "",
      status: "Proses",
    });

    setSelectedCustomer(null);
    setErrorMessage("");
    setModalType("add");
  };

  /* =========================================================
     EDIT
  ========================================================= */

  const openEditForm = (customer) => {
    setFormData({
      name: customer.name,
      phone: customer.phone,
      package: customer.package,
      date: customer.date,
      packagePrice: customer.packagePrice,
      addon: customer.addon,
      addonNote: customer.addonNote,
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
     SUBMIT
  ========================================================= */

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");

    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError || !sessionData?.session) {
      setErrorMessage(
        "Sesi login Supabase tidak ditemukan. Silakan login kembali."
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
      total:
        modalType === "edit" && selectedCustomer
          ? Number(selectedCustomer.total || 0)
          : 0,
    };

    /* =====================================================
       EDIT
    ===================================================== */

    if (modalType === "edit") {
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

      setCustomers((current) =>
        current.map((customer) =>
          customer.id === selectedCustomer.id
            ? updatedCustomer
            : customer
        )
      );

      if (updatedCustomer.date) {
        setSelectedYear(updatedCustomer.date.slice(0, 4));
        setSelectedMonth(updatedCustomer.date.slice(5, 7));
      }

      closeModal();
      return;
    }

    /* =====================================================
       ADD
    ===================================================== */

    const { data, error } = await supabase
      .from("customers")
      .insert([convertToDatabase(customerData)])
      .select()
      .single();

    if (error) {
      console.error("INSERT CUSTOMER ERROR:", error);

      setErrorMessage(
        `Gagal menyimpan customer: ${error.message}`
      );
      return;
    }

    const newCustomer = convertFromDatabase(data);

    setCustomers((current) => [...current, newCustomer]);

    if (newCustomer.date) {
      setSelectedYear(newCustomer.date.slice(0, 4));
      setSelectedMonth(newCustomer.date.slice(5, 7));
    }

    closeModal();
  };

  /* =========================================================
     DELETE
  ========================================================= */

  const deleteCustomer = async (customer) => {
    const confirmed = window.confirm(
      `Hapus customer "${customer.name}"?`
    );

    if (!confirmed) return;

    setErrorMessage("");

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
            <select
              value={activeMonth}
              onChange={(event) =>
                setSelectedMonth(event.target.value)
              }
              disabled={customerMonths.length === 0}
            >
              {customerMonths.length === 0 ? (
                <option value="">No Data</option>
              ) : (
                customerMonths.map((month) => (
                  <option key={month} value={month}>
                    {monthNames[Number(month) - 1]}
                  </option>
                ))
              )}
            </select>

            <select
              value={activeYear}
              onChange={(event) =>
                setSelectedYear(event.target.value)
              }
              disabled={customerYears.length === 0}
            >
              {customerYears.length === 0 ? (
                <option value="">No Data</option>
              ) : (
                customerYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))
              )}
            </select>
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
              {loading
                ? "..."
                : formatRupiah(totalRevenue)}
            </div>

            <div className="customer-stat-note">
              Total transaksi bulan ini
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

              <div className="customer-header-actions">
                <button
                  type="button"
                  className="customer-pdf-button"
                  onClick={handleDownloadPDF}
                >
                  Download PDF
                </button>

                <button
                  type="button"
                  className="add-customer-button"
                  onClick={openAddForm}
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          <div className="customer-table-scroll">
            <table className="customer-table">
              <thead>
                <tr>
                  <th>CUSTOMER</th>
                  <th>PACKAGE</th>
                  <th>DATE</th>
                  <th>TOTAL</th>
                  <th>STATUS</th>
                  <th>ACTION</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan="6"
                      className="empty-customer"
                    >
                      Loading customer...
                    </td>
                  </tr>
                ) : filteredCustomers.length === 0 ? (
                  <tr>
                    <td
                      colSpan="6"
                      className="empty-customer"
                    >
                      Tidak ada customer pada{" "}
                      {monthNamesIndonesia[
                        Number(activeMonth) - 1
                      ] || "-"}{" "}
                      {activeYear}.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((customer) => (
                    <tr key={customer.id}>
                      <td>
                        <div className="customer-name">
                          {customer.name}
                        </div>

                        <div className="customer-contact">
                          {customer.phone}
                        </div>
                      </td>

                      <td className="customer-package">
                        {customer.package || "-"}
                      </td>

                      <td className="customer-date">
                        {formatDate(customer.date)}
                      </td>

                      <td className="customer-total">
                        {formatRupiah(
                          getGrandTotal(customer)
                        )}
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
                          {customer.status}
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

                          <button
                            type="button"
                            onClick={() =>
                              openEditForm(customer)
                            }
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="customer-footer">
          <span>PLUNO INTERNAL SYSTEM</span>
          <span>v1.0 · 2026</span>
        </footer>
      </main>

      {/* ADD / EDIT */}

      {(modalType === "add" || modalType === "edit") && (
        <div className="customer-overlay">
          <div className="customer-form-box">
            <div className="customer-form-header">
              <div>
                <div className="customer-form-kicker">
                  {modalType === "edit"
                    ? "EDIT CUSTOMER"
                    : "CUSTOMER DATA"}
                </div>

                <h2>
                  {modalType === "edit"
                    ? "Edit Customer"
                    : "Tambah Customer"}
                </h2>

                <p>
                  {modalType === "edit"
                    ? "Perbarui informasi customer."
                    : "Masukkan informasi customer baru."}
                </p>
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
                      Proses
                    </option>

                    <option value="Selesai">
                      Selesai
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
                {modalType === "edit" && (
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
                )}

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
                    {modalType === "edit"
                      ? "Save Changes"
                      : "Save Customer"}
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
                  {formatRupiah(
                    selectedCustomer.packagePrice
                  )}
                </strong>
              </div>

              <div className="detail-item">
                <span>ADD-ON</span>

                <strong>
                  {formatRupiah(
                    selectedCustomer.addon
                  )}
                </strong>
              </div>

              <div className="detail-item detail-wide">
                <span>ADD-ON INFORMATION</span>

                <strong>
                  {selectedCustomer.addonNote || "-"}
                </strong>
              </div>

              <div className="detail-item">
                <span>GRAND TOTAL</span>

                <strong>
                  {formatRupiah(
                    getGrandTotal(
                      selectedCustomer
                    )
                  )}
                </strong>
              </div>

              <div className="detail-item">
                <span>STATUS</span>

                <strong>
                  {selectedCustomer.status}
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

              <button
                type="button"
                className="customer-save"
                onClick={() =>
                  openEditForm(selectedCustomer)
                }
              >
                Edit Customer
              </button>
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
        </div>

        <table className="print-table">
          <thead>
            <tr>
              <th>NO</th>
              <th>CUSTOMER</th>
              <th>PHONE</th>
              <th>PACKAGE</th>
              <th>SESSION DATE</th>
              <th>TOTAL</th>
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
                    getGrandTotal(customer)
                  )}
                </td>

                <td>{customer.status}</td>
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