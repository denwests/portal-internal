import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import Sidebar from "../components/Sidebar";
import "./Employee.css";


function Employee() {

  const [
    employees,
    setEmployees,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");


  const [
    modalType,
    setModalType,
  ] = useState(null);

  const [
    selectedEmployee,
    setSelectedEmployee,
  ] = useState(null);


  const [
    formData,
    setFormData,
  ] = useState({

    name: "",
    email: "",
    role: "Staff",
    status: "Aktif",

  });


  /* =========================================================
     LOAD EMPLOYEES
  ========================================================= */

  const fetchEmployees =
    async () => {

      setLoading(true);

      setErrorMessage("");


      const {
        data,
        error,
      } = await supabase
        .from(
          "employees"
        )
        .select(
          "*"
        )
        .order(
          "name",
          {
            ascending: true,
          }
        );


      if (error) {

        console.error(
          error
        );

        setErrorMessage(
          "Gagal mengambil data karyawan dari database."
        );

        setEmployees([]);

        setLoading(false);

        return;

      }


      setEmployees(
        data || []
      );

      setLoading(false);

    };


  useEffect(() => {

    fetchEmployees();

  }, []);


  /* =========================================================
     SEARCH
  ========================================================= */

  const filteredEmployees =
    employees.filter(
      (employee) => {

        const text = `
          ${employee.name || ""}
          ${employee.email || ""}
          ${employee.role || ""}
          ${employee.status || ""}
        `;


        return text
          .toLowerCase()
          .includes(
            search.toLowerCase()
          );

      }
    );


  /* =========================================================
     STATISTICS
  ========================================================= */

  const totalActive =
    employees.filter(
      (employee) =>
        employee.status ===
        "Aktif"
    ).length;


  const totalAdministrator =
    employees.filter(
      (employee) =>
        employee.role ===
        "Administrator"
    ).length;


  /* =========================================================
     ADD FORM
  ========================================================= */

  const openAddForm =
    () => {

      setFormData({

        name: "",
        email: "",
        role: "Staff",
        status: "Aktif",

      });


      setSelectedEmployee(
        null
      );

      setModalType(
        "add"
      );

      setErrorMessage("");

    };


  /* =========================================================
     EDIT FORM
  ========================================================= */

  const openEditForm =
    (employee) => {

      setFormData({

        name:
          employee.name ||
          "",

        email:
          employee.email ||
          "",

        role:
          employee.role ||
          "Staff",

        status:
          employee.status ||
          "Aktif",

      });


      setSelectedEmployee(
        employee
      );

      setModalType(
        "edit"
      );

      setErrorMessage("");

    };


  /* =========================================================
     DETAIL
  ========================================================= */

  const openDetail =
    (employee) => {

      setSelectedEmployee(
        employee
      );

      setModalType(
        "detail"
      );

      setErrorMessage("");

    };


  /* =========================================================
     CLOSE MODAL
  ========================================================= */

  const closeModal =
    () => {

      setModalType(
        null
      );

      setSelectedEmployee(
        null
      );

      setErrorMessage("");

    };


  /* =========================================================
     FORM CHANGE
  ========================================================= */

  const handleChange =
    (event) => {

      const {
        name,
        value,
      } = event.target;


      setFormData(
        (current) => ({

          ...current,

          [name]: value,

        })
      );

    };


  /* =========================================================
     CREATE EMPLOYEE
  ========================================================= */

  const createEmployee =
    async () => {

      try {

        const {
          data,
          error,
        } =
          await supabase
            .functions
            .invoke(
              "quick-endpoint",
              {

                body: {

                  action:
                    "create_employee",

                  name:
                    formData.name,

                  email:
                    formData.email,

                  role:
                    formData.role,

                  status:
                    formData.status,

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

        console.error(
          error
        );


        setErrorMessage(
          error?.message ||
          "Gagal membuat akun karyawan."
        );

      }

    };


  /* =========================================================
     UPDATE EMPLOYEE
  ========================================================= */

  const updateEmployee =
    async () => {

      if (
        !selectedEmployee
      ) {
        return;
      }


      const {
        data,
        error,
      } =
        await supabase
          .from(
            "employees"
          )
          .update({

            name:
              formData.name,

            email:
              formData.email,

            role:
              formData.role,

            status:
              formData.status,

          })
          .eq(
            "id",
            selectedEmployee.id
          )
          .select()
          .single();


      if (error) {

        console.error(
          error
        );


        setErrorMessage(
          "Gagal memperbarui data karyawan."
        );

        return;

      }


      setEmployees(
        (current) =>
          current.map(
            (employee) =>
              employee.id ===
              selectedEmployee.id
                ? data
                : employee
          )
      );


      closeModal();

    };


  /* =========================================================
     SUBMIT
  ========================================================= */

  const handleSubmit =
    async (event) => {

      event.preventDefault();


      setErrorMessage("");


      if (
        !formData.name.trim()
      ) {

        setErrorMessage(
          "Nama karyawan wajib diisi."
        );

        return;

      }


      if (
        !formData.email.trim()
      ) {

        setErrorMessage(
          "Email wajib diisi."
        );

        return;

      }


      if (
        modalType ===
        "add"
      ) {

        await createEmployee();

        return;

      }


      if (
        modalType ===
        "edit"
      ) {

        await updateEmployee();

      }

    };


  /* =========================================================
     DELETE
  ========================================================= */

  const deleteEmployee =
    async (
      employee
    ) => {

      if (!employee) {
        return;
      }


      if (
        employee.role ===
        "Founder"
      ) {

        alert(
          "Akun Founder tidak dapat dihapus."
        );

        return;

      }


      const confirmed =
        window.confirm(
          `Hapus karyawan "${employee.name}"?`
        );


      if (!confirmed) {
        return;
      }


      setErrorMessage("");


      const {
        error,
      } =
        await supabase
          .from(
            "employees"
          )
          .delete()
          .eq(
            "id",
            employee.id
          );


      if (error) {

        console.error(
          error
        );


        setErrorMessage(
          "Gagal menghapus karyawan."
        );

        return;

      }


      setEmployees(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              employee.id
          )
      );


      closeModal();

    };


  /* =========================================================
     RENDER
  ========================================================= */

  return (

    <div className="employee-page">


      {/* =================================================
          SIDEBAR
      ================================================= */}

      <Sidebar
        activePage="employee"
      />


      {/* =================================================
          MAIN
      ================================================= */}

      <main className="employee-main">


        {/* =================================================
            OVERVIEW
        ================================================= */}

        <div className="employee-section-heading">

          <div>

            <div className="employee-section-label">
              PLUNO STUDIO / EMPLOYEE MANAGEMENT
            </div>

            <h2>
              Employee Overview
            </h2>

          </div>

        </div>


        {/* =================================================
            ERROR
        ================================================= */}

        {errorMessage &&
          !modalType && (

          <div className="employee-error">

            {errorMessage}

          </div>

        )}


        {/* =================================================
            STATISTICS
        ================================================= */}

        <section className="employee-stat-grid">


          {/* TOTAL EMPLOYEE */}

          <div className="employee-stat-card">

            <div className="employee-stat-label">
              TOTAL EMPLOYEE
            </div>

            <div className="employee-stat-value">

              {
                loading
                  ? "..."
                  : employees.length
              }

            </div>

            <div className="employee-stat-note">
              Seluruh anggota internal
            </div>

          </div>


          {/* ACTIVE */}

          <div className="employee-stat-card">

            <div className="employee-stat-label">
              ACTIVE
            </div>

            <div className="employee-stat-value">

              {
                loading
                  ? "..."
                  : totalActive
              }

            </div>

            <div className="employee-stat-note">
              Karyawan aktif
            </div>

          </div>


          {/* ADMINISTRATOR */}

          <div className="employee-stat-card">

            <div className="employee-stat-label">
              ADMINISTRATOR
            </div>

            <div className="employee-stat-value">

              {
                loading
                  ? "..."
                  : totalAdministrator
              }

            </div>

            <div className="employee-stat-note">
              Pengelola operasional sistem
            </div>

          </div>


        </section>


        {/* =================================================
            EMPLOYEE LIST
        ================================================= */}

        <section className="employee-list-section">


          {/* HEADER */}

          <div className="employee-list-header">


            <div>

              <div className="employee-eyebrow">
                EMPLOYEE DATABASE
              </div>

              <h2>
                Employee List
              </h2>

            </div>


            <div className="employee-list-right">


              <span>

                {
                  filteredEmployees.length
                } EMPLOYEE

              </span>


              {/* SEARCH */}

              <div className="employee-search-box">

                <span>
                  /
                </span>

                <input
                  type="text"
                  placeholder="Search employee..."
                  value={
                    search
                  }
                  onChange={(
                    event
                  ) =>
                    setSearch(
                      event.target.value
                    )
                  }
                />

              </div>


              {/* ADD */}

              <button
                type="button"
                className="add-employee-button"
                onClick={
                  openAddForm
                }
              >
                Add
              </button>


            </div>

          </div>


          {/* =================================================
              TABLE
          ================================================= */}

          <div className="employee-table-scroll">

            <table className="employee-table">


              <thead>

                <tr>

                  <th>
                    EMPLOYEE
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
                    ACTION
                  </th>

                </tr>

              </thead>


              <tbody>


                {loading ? (

                  <tr>

                    <td
                      colSpan="5"
                      className="empty-employee"
                    >
                      Loading employee...
                    </td>

                  </tr>

                ) : filteredEmployees.length ===
                  0 ? (

                  <tr>

                    <td
                      colSpan="5"
                      className="empty-employee"
                    >
                      Tidak ada data karyawan.
                    </td>

                  </tr>

                ) : (

                  filteredEmployees.map(
                    (
                      employee
                    ) => (

                      <tr
                        key={
                          employee.id
                        }
                      >


                        {/* NAME */}

                        <td>

                          <div className="employee-name">

                            {
                              employee.name ||
                              "-"
                            }

                          </div>

                        </td>


                        {/* EMAIL */}

                        <td className="employee-email">

                          {
                            employee.email ||
                            "-"
                          }

                        </td>


                        {/* ROLE */}

                        <td>

                          <span className="employee-role-badge">

                            {
                              employee.role ||
                              "-"
                            }

                          </span>

                        </td>


                        {/* STATUS */}

                        <td>

                          <span
                            className={`employee-status ${
                              employee.status ===
                              "Aktif"
                                ? "employee-status-active"
                                : "employee-status-inactive"
                            }`}
                          >

                            {
                              employee.status ||
                              "-"
                            }

                          </span>

                        </td>


                        {/* ACTION */}

                        <td>

                          <div className="employee-actions">


                            <button
                              type="button"
                              onClick={() =>
                                openDetail(
                                  employee
                                )
                              }
                            >
                              View
                            </button>


                            <button
                              type="button"
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
                  )

                )}


              </tbody>


            </table>

          </div>


        </section>


        {/* =================================================
            FOOTER
        ================================================= */}

        <footer className="employee-footer">

          <span>
            PLUNO INTERNAL SYSTEM
          </span>

          <span>
            v1.0 · 2026
          </span>

        </footer>


      </main>


      {/* =================================================
          ADD / EDIT MODAL
      ================================================= */}

      {(modalType === "add" ||
        modalType === "edit") && (

        <div className="employee-overlay">


          <div className="employee-form-box">


            {/* HEADER */}

            <div className="employee-form-header">


              <div>

                <div className="employee-form-kicker">

                  {
                    modalType ===
                    "edit"
                      ? "EDIT EMPLOYEE"
                      : "EMPLOYEE DATA"
                  }

                </div>


                <h2>

                  {
                    modalType ===
                    "edit"
                      ? "Edit Employee"
                      : "Tambah Employee"
                  }

                </h2>


                <p>

                  {
                    modalType ===
                    "edit"
                      ? "Perbarui informasi dan hak akses karyawan."
                      : "Masukkan informasi karyawan baru."
                  }

                </p>

              </div>


              <button
                type="button"
                className="employee-form-close"
                onClick={
                  closeModal
                }
                aria-label="Close"
              >
                ×
              </button>


            </div>


            {/* ERROR */}

            {errorMessage && (

              <div className="employee-modal-error">

                {errorMessage}

              </div>

            )}


            {/* FORM */}

            <form
              onSubmit={
                handleSubmit
              }
            >


              <div className="employee-form-grid">


                {/* NAME */}

                <div className="employee-field">

                  <label>
                    FULL NAME
                  </label>

                  <input
                    type="text"
                    name="name"
                    placeholder="Employee name"
                    value={
                      formData.name
                    }
                    onChange={
                      handleChange
                    }
                    required
                  />

                </div>


                {/* EMAIL */}

                <div className="employee-field">

                  <label>
                    LOGIN EMAIL
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
                      modalType ===
                      "edit"
                    }
                  />

                </div>


                {/* ROLE */}

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


                {/* STATUS */}

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


              {/* =================================================
                  ACCESS INFO
              ================================================= */}

              <div className="employee-role-info">


                <div className="employee-role-info-title">
                  ACCESS LEVEL
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
                      Akses operasional, customer, dan finance.
                    </span>

                  </div>


                  <div>

                    <strong>
                      Staff
                    </strong>

                    <span>
                      Akses umum sesuai permission Staff.
                    </span>

                  </div>


                </div>


              </div>


              {/* =================================================
                  FOOTER
              ================================================= */}

              <div className="employee-form-footer">


                <div>

                  {modalType ===
                    "edit" && (

                    <button
                      type="button"
                      className="employee-delete-button"
                      onClick={() =>
                        deleteEmployee(
                          selectedEmployee
                        )
                      }
                    >
                      Delete
                    </button>

                  )}

                </div>


                <div className="employee-form-footer-right">


                  <button
                    type="button"
                    className="employee-cancel"
                    onClick={
                      closeModal
                    }
                  >
                    Cancel
                  </button>


                  <button
                    type="submit"
                    className="employee-save"
                  >

                    {
                      modalType ===
                      "edit"
                        ? "Save Changes"
                        : "Create Account"
                    }

                  </button>


                </div>


              </div>


            </form>


          </div>


        </div>

      )}


      {/* =================================================
          DETAIL MODAL
      ================================================= */}

      {modalType ===
        "detail" &&
        selectedEmployee && (

        <div className="employee-overlay">


          <div className="employee-detail-box">


            {/* HEADER */}

            <div className="employee-form-header">


              <div>

                <div className="employee-form-kicker">
                  EMPLOYEE PROFILE
                </div>

                <h2>
                  {
                    selectedEmployee.name
                  }
                </h2>

                <p>
                  Detail informasi karyawan.
                </p>

              </div>


              <button
                type="button"
                className="employee-form-close"
                onClick={
                  closeModal
                }
                aria-label="Close"
              >
                ×
              </button>


            </div>


            {/* DETAIL */}

            <div className="employee-detail-grid">


              <div className="employee-detail-item">

                <span>
                  NAME
                </span>

                <strong>
                  {
                    selectedEmployee.name ||
                    "-"
                  }
                </strong>

              </div>


              <div className="employee-detail-item">

                <span>
                  EMAIL
                </span>

                <strong>
                  {
                    selectedEmployee.email ||
                    "-"
                  }
                </strong>

              </div>


              <div className="employee-detail-item">

                <span>
                  ROLE
                </span>

                <strong>
                  {
                    selectedEmployee.role ||
                    "-"
                  }
                </strong>

              </div>


              <div className="employee-detail-item">

                <span>
                  STATUS
                </span>

                <strong>
                  {
                    selectedEmployee.status ||
                    "-"
                  }
                </strong>

              </div>


            </div>


            {/* FOOTER */}

            <div className="employee-detail-footer">


              <button
                type="button"
                className="employee-cancel"
                onClick={
                  closeModal
                }
              >
                Close
              </button>


              <button
                type="button"
                className="employee-save"
                onClick={() =>
                  openEditForm(
                    selectedEmployee
                  )
                }
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