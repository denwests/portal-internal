import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import Sidebar from "../components/Sidebar";
import "./Employee.css";

function Employee() {
  const currentEmployeeRole =
    localStorage.getItem("employeeRole") || "Staff";

  const isFounder = currentEmployeeRole === "Founder";

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [search, setSearch] = useState("");

  const [modalType, setModalType] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    role: "Staff",
    status: "Aktif",
  });

  /* =========================================================
     LOAD EMPLOYEES
  ========================================================= */

  const fetchEmployees = async () => {
    setLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.error(error);
      setErrorMessage("Gagal mengambil data karyawan dari database.");
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

  /* =========================================================
     SEARCH
  ========================================================= */

  const filteredEmployees = employees.filter((employee) => {
    const text = `
      ${employee.name || ""}
      ${employee.username || ""}
      ${employee.email || ""}
      ${employee.role || ""}
      ${employee.status || ""}
    `;

    return text.toLowerCase().includes(search.toLowerCase());
  });

  const totalActive = employees.filter(
    (employee) => employee.status === "Aktif"
  ).length;

  const totalAdministrator = employees.filter(
    (employee) => employee.role === "Administrator"
  ).length;

  /* =========================================================
     MODAL
  ========================================================= */

  const openAddForm = () => {
    setFormData({
      name: "",
      username: "",
      email: "",
      role: "Staff",
      status: "Aktif",
    });

    setSelectedEmployee(null);
    setModalType("add");
    setErrorMessage("");
    setSuccessMessage("");
  };

  const openEditForm = (employee) => {
    setFormData({
      name: employee.name || "",
      username: employee.username || "",
      email: employee.email || "",
      role: employee.role || "Staff",
      status: employee.status || "Aktif",
    });

    setSelectedEmployee(employee);
    setModalType("edit");
    setErrorMessage("");
    setSuccessMessage("");
  };

  const openDetail = (employee) => {
    setSelectedEmployee(employee);
    setModalType("detail");
    setErrorMessage("");
    setSuccessMessage("");
  };

  const closeModal = () => {
    setModalType(null);
    setSelectedEmployee(null);
    setErrorMessage("");
    setSuccessMessage("");
    setSaving(false);
    setResettingPassword(false);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  /* =========================================================
     EDGE FUNCTION HELPER
  ========================================================= */

  const invokeEmployeeAction = async (body) => {
    const { data, error } = await supabase.functions.invoke(
      "quick-endpoint",
      { body }
    );

    if (error) {
      console.error("EDGE FUNCTION ERROR:", error);

      let message =
        error?.message ||
        "Edge Function gagal menjalankan permintaan.";

      try {
        if (error?.context) {
          const payload = await error.context.json();

          if (payload?.error) {
            message = payload.error;
          }
        }
      } catch (contextError) {
        console.error(
          "Gagal membaca response Edge Function:",
          contextError
        );
      }

      throw new Error(message);
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return data;
  };

  /* =========================================================
     CREATE EMPLOYEE
  ========================================================= */

  const createEmployee = async () => {
    const data = await invokeEmployeeAction({
      action: "create_employee",
      name: formData.name.trim(),
      username: formData.username.trim(),
      email: formData.email.trim().toLowerCase(),
      role: formData.role,
      status: formData.status,
    });

    await fetchEmployees();

    if (data?.password_email_sent === false) {
      setSuccessMessage(
        "Employee berhasil dibuat, tetapi email setup password belum terkirim. Buka Edit Employee lalu gunakan Reset Password."
      );
      return;
    }

    closeModal();
  };

  /* =========================================================
     UPDATE EMPLOYEE
     Username sengaja tidak dikirim agar immutable.
  ========================================================= */

  const updateEmployee = async () => {
    if (!selectedEmployee) return;

    const data = await invokeEmployeeAction({
      action: "update_employee",
      employee_id: selectedEmployee.id,
      name: formData.name.trim(),
      email: formData.email.trim().toLowerCase(),
      role: formData.role,
      status: formData.status,
    });

    const updatedEmployee = data?.employee;

    if (updatedEmployee) {
      setEmployees((current) =>
        current.map((employee) =>
          employee.id === selectedEmployee.id
            ? updatedEmployee
            : employee
        )
      );
    } else {
      await fetchEmployees();
    }

    closeModal();
  };

  /* =========================================================
     RESET PASSWORD - FOUNDER ONLY
  ========================================================= */

  const handleResetPassword = async () => {
    if (!isFounder || !selectedEmployee) return;

    const confirmed = window.confirm(
      `Kirim link Reset Password ke ${selectedEmployee.email}?\n\nPassword baru akan dibuat sendiri oleh pemilik email dan tidak dapat dilihat oleh Founder.`
    );

    if (!confirmed) return;

    setResettingPassword(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const data = await invokeEmployeeAction({
        action: "reset_password",
        employee_id: selectedEmployee.id,
      });

      setSuccessMessage(
        data?.message ||
          `Link Reset Password telah dikirim ke ${selectedEmployee.email}.`
      );
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error?.message || "Gagal mengirim email Reset Password."
      );
    } finally {
      setResettingPassword(false);
    }
  };

  /* =========================================================
     SUBMIT
  ========================================================= */

  const handleSubmit = async (event) => {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    if (!formData.name.trim()) {
      setErrorMessage("Nama karyawan wajib diisi.");
      return;
    }

    if (modalType === "add" && !formData.username.trim()) {
      setErrorMessage("Username wajib diisi.");
      return;
    }

    if (!formData.email.trim()) {
      setErrorMessage("Email wajib diisi.");
      return;
    }

    setSaving(true);

    try {
      if (modalType === "add") {
        await createEmployee();
        return;
      }

      if (modalType === "edit") {
        await updateEmployee();
      }
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error?.message ||
          (modalType === "add"
            ? "Gagal membuat akun karyawan."
            : "Gagal memperbarui data karyawan.")
      );
    } finally {
      setSaving(false);
    }
  };

  /* =========================================================
     DELETE
  ========================================================= */

  const deleteEmployee = async (employee) => {
    if (!employee || !isFounder) return;

    if (employee.role === "Founder") {
      alert("Akun Founder tidak dapat dihapus.");
      return;
    }

    const confirmed = window.confirm(
      `Hapus karyawan "${employee.name}"?\n\nAkun employee juga akan dihapus dari Supabase Authentication sehingga email yang sama dapat digunakan kembali.`
    );

    if (!confirmed) return;

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await invokeEmployeeAction({
        action: "delete_employee",
        employee_id: employee.id,
      });

      setEmployees((current) =>
        current.filter((item) => item.id !== employee.id)
      );

      closeModal();
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error?.message ||
          "Gagal menghapus employee dan akun Authentication."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="employee-page">
      <Sidebar activePage="employee" />

      <main className="employee-main">
        <div className="employee-section-heading">
          <div>
            <div className="employee-section-label">
              PLUNO STUDIO / EMPLOYEE MANAGEMENT
            </div>
            <h2>Employee Overview</h2>
          </div>
        </div>

        {errorMessage && !modalType && (
          <div className="employee-error">{errorMessage}</div>
        )}

        <section className="employee-stat-grid">
          <div className="employee-stat-card">
            <div className="employee-stat-label">TOTAL EMPLOYEE</div>
            <div className="employee-stat-value">
              {loading ? "..." : employees.length}
            </div>
            <div className="employee-stat-note">Seluruh anggota internal</div>
          </div>

          <div className="employee-stat-card">
            <div className="employee-stat-label">ACTIVE</div>
            <div className="employee-stat-value">
              {loading ? "..." : totalActive}
            </div>
            <div className="employee-stat-note">Karyawan aktif</div>
          </div>

          <div className="employee-stat-card">
            <div className="employee-stat-label">ADMINISTRATOR</div>
            <div className="employee-stat-value">
              {loading ? "..." : totalAdministrator}
            </div>
            <div className="employee-stat-note">
              Pengelola operasional sistem
            </div>
          </div>
        </section>

        <section className="employee-list-section">
          <div className="employee-list-header">
            <div>
              <div className="employee-eyebrow">EMPLOYEE DATABASE</div>
              <h2>Employee List</h2>
            </div>

            <div className="employee-list-right">
              <span>{filteredEmployees.length} EMPLOYEE</span>

              <div className="employee-search-box">
                <span>/</span>
                <input
                  type="text"
                  placeholder="Search employee..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>

              <button
                type="button"
                className="add-employee-button"
                onClick={openAddForm}
              >
                Add
              </button>
            </div>
          </div>

          <div className="employee-table-scroll">
            <table className="employee-table">
              <thead>
                <tr>
                  <th>EMPLOYEE</th>
                  <th>USERNAME</th>
                  <th>EMAIL</th>
                  <th>ROLE</th>
                  <th>STATUS</th>
                  <th>ACTION</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" className="empty-employee">
                      Loading employee...
                    </td>
                  </tr>
                ) : filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="empty-employee">
                      Tidak ada data karyawan.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((employee) => (
                    <tr key={employee.id}>
                      <td>
                        <div className="employee-name">
                          {employee.name || "-"}
                        </div>
                      </td>

                      <td className="employee-username">
                        {employee.username || "-"}
                      </td>

                      <td className="employee-email">
                        {employee.email || "-"}
                      </td>

                      <td>
                        <span className="employee-role-badge">
                          {employee.role || "-"}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`employee-status ${
                            employee.status === "Aktif"
                              ? "employee-status-active"
                              : "employee-status-inactive"
                          }`}
                        >
                          {employee.status || "-"}
                        </span>
                      </td>

                      <td>
                        <div className="employee-actions">
                          <button
                            type="button"
                            onClick={() => openDetail(employee)}
                          >
                            View
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditForm(employee)}
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

        <footer className="employee-footer">
          <span>PLUNO INTERNAL SYSTEM</span>
          <span>v1.0 · 2026</span>
        </footer>
      </main>

      {(modalType === "add" || modalType === "edit") && (
        <div className="employee-overlay">
          <div className="employee-form-box">
            <div className="employee-form-header">
              <div>
                <div className="employee-form-kicker">
                  {modalType === "edit" ? "EDIT EMPLOYEE" : "EMPLOYEE DATA"}
                </div>

                <h2>
                  {modalType === "edit"
                    ? "Edit Employee"
                    : "Tambah Employee"}
                </h2>

                <p>
                  {modalType === "edit"
                    ? "Perbarui informasi employee. Username tidak dapat diubah."
                    : "Buat employee baru dan tentukan username login."}
                </p>
              </div>

              <button
                type="button"
                className="employee-form-close"
                onClick={closeModal}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {errorMessage && (
              <div className="employee-modal-error">{errorMessage}</div>
            )}

            {successMessage && (
              <div className="employee-modal-success">{successMessage}</div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="employee-form-grid">
                <div className="employee-field">
                  <label>FULL NAME</label>
                  <input
                    type="text"
                    name="name"
                    placeholder="Employee name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="employee-field">
                  <label>USERNAME</label>
                  <input
                    type="text"
                    name="username"
                    placeholder="Username login"
                    value={formData.username}
                    onChange={handleChange}
                    required={modalType === "add"}
                    disabled={modalType === "edit"}
                    autoComplete="off"
                  />
                  {modalType === "edit" && (
                    <small className="employee-field-note">
                      Username bersifat permanen dan tidak dapat diubah.
                    </small>
                  )}
                </div>

                <div className="employee-field">
                  <label>EMAIL</label>
                  <input
                    type="email"
                    name="email"
                    placeholder="nama@email.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="employee-field">
                  <label>ROLE</label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                  >
                    <option value="Founder">Founder</option>
                    <option value="Administrator">Administrator</option>
                    <option value="Staff">Staff</option>
                  </select>
                </div>

                <div className="employee-field">
                  <label>STATUS</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                  >
                    <option value="Aktif">Aktif</option>
                    <option value="Nonaktif">Nonaktif</option>
                  </select>
                </div>
              </div>

              <div className="employee-role-info">
                <div className="employee-role-info-title">ACCOUNT SECURITY</div>
                <div className="employee-security-copy">
                  Username digunakan untuk login dan tidak dapat diubah setelah
                  akun dibuat. Email digunakan untuk autentikasi Supabase dan
                  pengiriman Reset Password.
                </div>
              </div>

              <div className="employee-form-footer">
                <div className="employee-form-footer-left">
                  {modalType === "edit" && isFounder && (
                    <button
                      type="button"
                      className="employee-reset-password-button"
                      onClick={handleResetPassword}
                      disabled={resettingPassword || saving}
                    >
                      {resettingPassword ? "Sending..." : "Reset Password"}
                    </button>
                  )}

                  {modalType === "edit" &&
                    selectedEmployee?.role !== "Founder" && (
                      <button
                        type="button"
                        className="employee-delete-button"
                        onClick={() => deleteEmployee(selectedEmployee)}
                        disabled={saving || resettingPassword}
                      >
                        Delete
                      </button>
                    )}
                </div>

                <div className="employee-form-footer-right">
                  <button
                    type="button"
                    className="employee-cancel"
                    onClick={closeModal}
                    disabled={saving || resettingPassword}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="employee-save"
                    disabled={saving || resettingPassword}
                  >
                    {saving
                      ? "Saving..."
                      : modalType === "edit"
                      ? "Save Changes"
                      : "Create Account"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalType === "detail" && selectedEmployee && (
        <div className="employee-overlay">
          <div className="employee-detail-box">
            <div className="employee-form-header">
              <div>
                <div className="employee-form-kicker">EMPLOYEE PROFILE</div>
                <h2>{selectedEmployee.name}</h2>
                <p>Detail informasi employee.</p>
              </div>

              <button
                type="button"
                className="employee-form-close"
                onClick={closeModal}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="employee-detail-grid">
              <div className="employee-detail-item">
                <span>NAME</span>
                <strong>{selectedEmployee.name || "-"}</strong>
              </div>

              <div className="employee-detail-item">
                <span>USERNAME</span>
                <strong>{selectedEmployee.username || "-"}</strong>
              </div>

              <div className="employee-detail-item">
                <span>EMAIL</span>
                <strong>{selectedEmployee.email || "-"}</strong>
              </div>

              <div className="employee-detail-item">
                <span>ROLE</span>
                <strong>{selectedEmployee.role || "-"}</strong>
              </div>

              <div className="employee-detail-item">
                <span>STATUS</span>
                <strong>{selectedEmployee.status || "-"}</strong>
              </div>
            </div>

            <div className="employee-detail-footer">
              <button
                type="button"
                className="employee-cancel"
                onClick={closeModal}
              >
                Close
              </button>

              <button
                type="button"
                className="employee-save"
                onClick={() => openEditForm(selectedEmployee)}
              >
                Edit Employee
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Employee;
