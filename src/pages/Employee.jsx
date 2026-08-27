import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import "./Employee.css";

function Employee() {
  const navigate = useNavigate();

  const employeeName =
    localStorage.getItem("employeeName") || "Raihan";

  const employeeRole =
    localStorage.getItem("employeeRole") || "Staff";

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [search, setSearch] = useState("");

  const [modalType, setModalType] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "Staff",
    status: "Aktif",
  });

  /* =========================
     LOAD EMPLOYEES
  ========================= */

  const fetchEmployees = async () => {
    setLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .order("name", {
        ascending: true,
      });

    if (error) {
      console.error(error);

      setErrorMessage(
        "Gagal mengambil data karyawan dari database."
      );

      setEmployees([]);
      setLoading(false);
      return;
    }

    setEmployees(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  /* =========================
     SEARCH
  ========================= */

  const filteredEmployees = employees.filter((employee) => {
    const text = `
      ${employee.name || ""}
      ${employee.email || ""}
      ${employee.role || ""}
      ${employee.status || ""}
    `;

    return text
      .toLowerCase()
      .includes(search.toLowerCase());
  });

  /* =========================
     ADD FORM
  ========================= */

  const openAddForm = () => {
    setFormData({
      name: "",
      email: "",
      role: "Staff",
      status: "Aktif",
    });

    setSelectedEmployee(null);
    setModalType("add");
    setErrorMessage("");
  };

  /* =========================
     EDIT FORM
  ========================= */

  const openEditForm = (employee) => {
    setFormData({
      name: employee.name || "",
      email: employee.email || "",
      role: employee.role || "Staff",
      status: employee.status || "Aktif",
    });

    setSelectedEmployee(employee);
    setModalType("edit");
    setErrorMessage("");
  };

  /* =========================
     DETAIL
  ========================= */

  const openDetail = (employee) => {
    setSelectedEmployee(employee);
    setModalType("detail");
  };

  /* =========================
     CLOSE
  ========================= */

  const closeModal = () => {
    setModalType(null);
    setSelectedEmployee(null);
    setErrorMessage("");
  };

  /* =========================
     FORM CHANGE
  ========================= */

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  /* =========================
     CREATE EMPLOYEE
  ========================= */

  const createEmployee = async () => {
    try {
      /*
        Panggil Edge Function yang memang
        sudah kamu deploy:
        
        quick-endpoint
      */

      const { data, error } =
        await supabase.functions.invoke(
          "quick-endpoint",
          {
            body: {
              action: "create_employee",

              name: formData.name,

              email: formData.email,

              role: formData.role,

              status: formData.status,
            },
          }
        );

      console.log(
        "CREATE EMPLOYEE RESPONSE:",
        data
      );

      if (error) {
        console.error(
          "EDGE FUNCTION ERROR:",
          error
        );

        throw error;
      }

      if (
        data &&
        data.error
      ) {
        throw new Error(
          data.error
        );
      }

      await fetchEmployees();

      closeModal();

    } catch (error) {
      console.error(error);

      setErrorMessage(
        error?.message ||
          "Gagal membuat akun karyawan."
      );
    }
  };

  /* =========================
     EDIT EMPLOYEE
  ========================= */

  const updateEmployee = async () => {
    const { data, error } =
      await supabase
        .from("employees")
        .update({
          name: formData.name,
          email: formData.email,
          role: formData.role,
          status: formData.status,
        })
        .eq(
          "id",
          selectedEmployee.id
        )
        .select()
        .single();

    if (error) {
      console.error(error);

      setErrorMessage(
        "Gagal memperbarui data karyawan."
      );

      return;
    }

    setEmployees((current) =>
      current.map((employee) =>
        employee.id === selectedEmployee.id
          ? data
          : employee
      )
    );

    closeModal();
  };

  /* =========================
     SUBMIT
  ========================= */

  const handleSubmit = async (event) => {
    event.preventDefault();

    setErrorMessage("");

    if (!formData.name.trim()) {
      setErrorMessage(
        "Nama karyawan wajib diisi."
      );
      return;
    }

    if (!formData.email.trim()) {
      setErrorMessage(
        "Email wajib diisi."
      );
      return;
    }

    /*
      Kalau ADD
      → buat akun Auth + employees
    */

    if (modalType === "add") {
      await createEmployee();
      return;
    }

    /*
      Kalau EDIT
      → update employees
    */

    if (modalType === "edit") {
      await updateEmployee();
    }
  };

  /* =========================
     DELETE
  ========================= */

  const deleteEmployee = async (
    employee
  ) => {
    if (employee.role === "Founder") {
      alert(
        "Akun Founder tidak dapat dihapus."
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Hapus karyawan "${employee.name}"?`
      );

    if (!confirmed) return;

    setErrorMessage("");

    const { error } =
      await supabase
        .from("employees")
        .delete()
        .eq(
          "id",
          employee.id
        );

    if (error) {
      console.error(error);

      setErrorMessage(
        "Gagal menghapus karyawan."
      );

      return;
    }

    setEmployees((current) =>
      current.filter(
        (item) =>
          item.id !== employee.id
      )
    );

    closeModal();
  };

  /* =========================
     LOGOUT
  ========================= */

  const handleLogout = async () => {
    await supabase.auth.signOut();

    localStorage.removeItem(
      "isLoggedIn"
    );

    localStorage.removeItem(
      "employeeId"
    );

    localStorage.removeItem(
      "employeeName"
    );

    localStorage.removeItem(
      "employeeRole"
    );

    window.location.href =
      "/login";
  };

  /* =========================
     RENDER
  ========================= */

  return (
    <div className="employee-page">

      {/* SIDEBAR */}

      <aside className="employee-sidebar">

        <div className="brand">

          <span className="brand-mark">
            P
          </span>

          <div>

            <div className="brand-name">
              PLUNO
            </div>

            <div className="brand-subtitle">
              INTERNAL PORTAL
            </div>

          </div>

        </div>

        <nav className="navigation">

          <div className="nav-section">
            WORKSPACE
          </div>

          <a
            className="nav-item"
            href="/dashboard"
          >
            <span>01</span>
            Dashboard
          </a>

          <a
            className="nav-item"
            href="/customer"
          >
            <span>02</span>
            Customer
          </a>

          <a
            className="nav-item active"
            href="/employee"
          >
            <span>03</span>
            Karyawan
          </a>

          <div className="nav-section second">
            MANAGEMENT
          </div>

          <a
            className="nav-item"
            href="#"
          >
            <span>04</span>
            Pembukuan
          </a>

          <a
            className="nav-item"
            href="#"
          >
            <span>05</span>
            Dokumen
          </a>

          <a
            className="nav-item"
            href="#"
          >
            <span>06</span>
            Pengumuman
          </a>

        </nav>

        <div className="sidebar-bottom">

          <div className="user-mini">

            <div className="avatar">
              {employeeName
                .charAt(0)
                .toUpperCase()}
            </div>

            <div>

              <div className="user-name">
                {employeeName}
              </div>

              <div className="user-role">
                {employeeRole}
              </div>

            </div>

          </div>

          <button
            className="logout"
            onClick={handleLogout}
          >
            Keluar
          </button>

        </div>

      </aside>

      {/* MAIN */}

      <main className="employee-main">

        <header className="employee-topbar">

          <div>

            <div className="employee-eyebrow">
              PLUNO STUDIO · HUMAN RESOURCES
            </div>

            <h1>
              Karyawan
            </h1>

            <p>
              Kelola data dan hak akses anggota internal PLUNO.
            </p>

          </div>

          <button
            className="add-employee-button"
            onClick={openAddForm}
          >
            + Tambah Karyawan
          </button>

        </header>

        {errorMessage && (
          <div className="employee-error">
            {errorMessage}
          </div>
        )}

        {/* STATISTICS */}

        <section className="employee-stat-grid">

          <div className="employee-stat-card">

            <div className="employee-stat-label">
              TOTAL KARYAWAN
            </div>

            <div className="employee-stat-value">
              {loading
                ? "..."
                : employees.length}
            </div>

            <div className="employee-stat-note">
              Seluruh anggota internal
            </div>

          </div>

          <div className="employee-stat-card">

            <div className="employee-stat-label">
              AKTIF
            </div>

            <div className="employee-stat-value">
              {loading
                ? "..."
                : employees.filter(
                    (employee) =>
                      employee.status ===
                      "Aktif"
                  ).length}
            </div>

            <div className="employee-stat-note">
              Karyawan aktif
            </div>

          </div>

          <div className="employee-stat-card">

            <div className="employee-stat-label">
              ADMINISTRATOR
            </div>

            <div className="employee-stat-value">
              {loading
                ? "..."
                : employees.filter(
                    (employee) =>
                      employee.role ===
                      "Administrator"
                  ).length}
            </div>

            <div className="employee-stat-note">
              Pengelola sistem
            </div>

          </div>

        </section>

        {/* LIST */}

        <section className="employee-list-section">

          <div className="employee-list-header">

            <div>

              <div className="employee-eyebrow">
                EMPLOYEE LIST
              </div>

              <h2>
                Daftar Karyawan
              </h2>

            </div>

            <div className="employee-list-right">

              <span>
                {filteredEmployees.length} data
              </span>

              <div className="employee-search-box">

                <span>
                  ⌕
                </span>

                <input
                  type="text"
                  placeholder="Cari karyawan..."
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                />

              </div>

            </div>

          </div>

          <div className="employee-table-scroll">

            {loading ? (
              <div className="empty-employee">
                Memuat data karyawan...
              </div>
            ) : (

              <>

                <table className="employee-table">

                  <thead>

                    <tr>

                      <th>
                        KARYAWAN
                      </th>

                      <th>
                        EMAIL
                      </th>

                      <th>
                        ROLE
                      </th>

                      <th>
                        STATUS
                      </th>

                      <th>
                        AKSI
                      </th>

                    </tr>

                  </thead>

                  <tbody>

                    {filteredEmployees.map(
                      (employee) => (

                        <tr
                          key={
                            employee.id
                          }
                        >

                          <td>

                            <div className="employee-name">
                              {employee.name}
                            </div>

                          </td>

                          <td>
                            {employee.email ||
                              "-"}
                          </td>

                          <td>

                            <span className="employee-role-badge">

                              {employee.role}

                            </span>

                          </td>

                          <td>

                            <span
                              className={`employee-status ${
                                employee.status ===
                                "Aktif"
                                  ? "employee-status-active"
                                  : "employee-status-inactive"
                              }`}
                            >
                              {employee.status}
                            </span>

                          </td>

                          <td>

                            <div className="employee-actions">

                              <button
                                onClick={() =>
                                  openDetail(
                                    employee
                                  )
                                }
                              >
                                Lihat
                              </button>

                              <button
                                onClick={() =>
                                  openEditForm(
                                    employee
                                  )
                                }
                              >
                                Edit
                              </button>

                            </div>

                          </td>

                        </tr>

                      )
                    )}

                  </tbody>

                </table>

                {filteredEmployees.length ===
                  0 && (
                  <div className="empty-employee">
                    Tidak ada data karyawan.
                  </div>
                )}

              </>

            )}

          </div>

        </section>

        <footer className="employee-footer">

          <span>
            PLUNO INTERNAL SYSTEM
          </span>

          <span>
            v1.0 · 2026
          </span>

        </footer>

      </main>

      {/* ADD / EDIT */}

      {(modalType === "add" ||
        modalType === "edit") && (

        <div className="employee-overlay">

          <div className="employee-form-box">

            <div className="employee-form-header">

              <div>

                <div className="employee-form-kicker">
                  {modalType === "edit"
                    ? "EDIT EMPLOYEE"
                    : "EMPLOYEE DATA"}
                </div>

                <h2>
                  {modalType === "edit"
                    ? "Edit Karyawan"
                    : "Tambah Karyawan"}
                </h2>

                <p>
                  {modalType === "edit"
                    ? "Perbarui informasi karyawan."
                    : "Masukkan informasi karyawan baru."}
                </p>

              </div>

              <button
                className="employee-form-close"
                onClick={closeModal}
              >
                ×
              </button>

            </div>

            <form
              onSubmit={handleSubmit}
            >

              <div className="employee-form-grid">

                <div className="employee-field">

                  <label>
                    NAMA LENGKAP
                  </label>

                  <input
                    type="text"
                    name="name"
                    placeholder="Nama karyawan"
                    value={
                      formData.name
                    }
                    onChange={
                      handleChange
                    }
                    required
                  />

                </div>

                <div className="employee-field">

                  <label>
                    EMAIL LOGIN
                  </label>

                  <input
                    type="email"
                    name="email"
                    placeholder="nama@pluno.id"
                    value={
                      formData.email
                    }
                    onChange={
                      handleChange
                    }
                    required
                    disabled={
                      modalType === "edit"
                    }
                  />

                </div>

                <div className="employee-field">

                  <label>
                    ROLE
                  </label>

                  <select
                    name="role"
                    value={
                      formData.role
                    }
                    onChange={
                      handleChange
                    }
                  >

                    <option value="Founder">
                      Founder
                    </option>

                    <option value="Administrator">
                      Administrator
                    </option>

                    <option value="Staff">
                      Staff
                    </option>

                  </select>

                </div>

                <div className="employee-field">

                  <label>
                    STATUS
                  </label>

                  <select
                    name="status"
                    value={
                      formData.status
                    }
                    onChange={
                      handleChange
                    }
                  >

                    <option value="Aktif">
                      Aktif
                    </option>

                    <option value="Nonaktif">
                      Nonaktif
                    </option>

                  </select>

                </div>

              </div>

              <div className="employee-role-info">

                <div className="employee-role-info-title">
                  HAK AKSES
                </div>

                <div className="employee-role-info-list">

                  <div>
                    <strong>
                      Founder
                    </strong>

                    <span>
                      Akses seluruh sistem.
                    </span>
                  </div>

                  <div>
                    <strong>
                      Administrator
                    </strong>

                    <span>
                      Dashboard dan Customer.
                    </span>
                  </div>

                  <div>
                    <strong>
                      Staff
                    </strong>

                    <span>
                      Dashboard saja.
                    </span>
                  </div>

                </div>

              </div>

              <div className="employee-form-footer">

                {modalType === "edit" && (
                  <button
                    type="button"
                    className="employee-delete-button"
                    onClick={() =>
                      deleteEmployee(
                        selectedEmployee
                      )
                    }
                  >
                    Hapus
                  </button>
                )}

                <div className="employee-form-footer-right">

                  <button
                    type="button"
                    className="employee-cancel"
                    onClick={closeModal}
                  >
                    Batal
                  </button>

                  <button
                    type="submit"
                    className="employee-save"
                  >
                    {modalType === "edit"
                      ? "Simpan Perubahan"
                      : "Buat Akun"}
                  </button>

                </div>

              </div>

            </form>

          </div>

        </div>
      )}

      {/* DETAIL */}

      {modalType === "detail" &&
        selectedEmployee && (

        <div className="employee-overlay">

          <div className="employee-detail-box">

            <div className="employee-form-header">

              <div>

                <div className="employee-form-kicker">
                  EMPLOYEE PROFILE
                </div>

                <h2>
                  {selectedEmployee.name}
                </h2>

                <p>
                  Detail informasi karyawan.
                </p>

              </div>

              <button
                className="employee-form-close"
                onClick={closeModal}
              >
                ×
              </button>

            </div>

            <div className="employee-detail-grid">

              <div className="employee-detail-item">

                <span>
                  NAMA
                </span>

                <strong>
                  {selectedEmployee.name}
                </strong>

              </div>

              <div className="employee-detail-item">

                <span>
                  EMAIL
                </span>

                <strong>
                  {selectedEmployee.email ||
                    "-"}
                </strong>

              </div>

              <div className="employee-detail-item">

                <span>
                  ROLE
                </span>

                <strong>
                  {selectedEmployee.role}
                </strong>

              </div>

              <div className="employee-detail-item">

                <span>
                  STATUS
                </span>

                <strong>
                  {selectedEmployee.status}
                </strong>

              </div>

            </div>

            <div className="employee-detail-footer">

              <button
                className="employee-cancel"
                onClick={closeModal}
              >
                Tutup
              </button>

              <button
                className="employee-save"
                onClick={() =>
                  openEditForm(
                    selectedEmployee
                  )
                }
              >
                Edit Karyawan
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}

export default Employee;