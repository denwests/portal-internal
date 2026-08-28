import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import Sidebar from "../components/Sidebar";
import "./Booking.css";


/* ==================================================
   BOOKING PERIOD FILTER
================================================== */

function getCurrentDateParts() {

  const currentDate =
    new Date();

  const year =
    String(
      currentDate.getFullYear()
    );

  const month =
    String(
      currentDate.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      currentDate.getDate()
    ).padStart(
      2,
      "0"
    );

  return {
    year,
    month,
    date: `${year}-${month}-${day}`,
  };

}


function getInitialPeriodFilter() {

  const current =
    getCurrentDateParts();

  const params =
    new URLSearchParams(
      window.location.search
    );

  const period =
    params.get(
      "period"
    );

  const type =
    [
      "date",
      "month",
      "year",
    ].includes(
      period
    )
      ? period
      : "date";

  const date =
    params.get(
      "date"
    );

  const month =
    params.get(
      "month"
    );

  const year =
    params.get(
      "year"
    );

  return {

    type,

    date:
      /^\d{4}-\d{2}-\d{2}$/.test(
        date || ""
      )
        ? date
        : current.date,

    month:
      /^(0[1-9]|1[0-2])$/.test(
        month || ""
      )
        ? month
        : current.month,

    year:
      /^\d{4}$/.test(
        year || ""
      )
        ? year
        : current.year,

  };

}


function Booking() {

  const [
    bookings,
    setBookings,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    showForm,
    setShowForm,
  ] = useState(false);

  const [
    showView,
    setShowView,
  ] = useState(false);

  const [
    editingBooking,
    setEditingBooking,
  ] = useState(null);

  const [
    viewingBooking,
    setViewingBooking,
  ] = useState(null);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    currentPage,
    setCurrentPage,
  ] = useState(0);

  const [
    periodFilter,
    setPeriodFilter,
  ] = useState(
    getInitialPeriodFilter
  );

  const [
    shareCopied,
    setShareCopied,
  ] = useState(false);


  const [
    form,
    setForm,
  ] = useState({

    customerName: "",
    bookingDate: "",
    startTime: "",
    packageName: "",
    status: "Complete",
    notes: "",
    downPayment: "",

  });


  /* ==================================================
     10 BOOKING PER PAGE
  ================================================== */

  const BOOKINGS_PER_PAGE = 10;


  /* ==================================================
     LOAD BOOKINGS
  ================================================== */

  useEffect(() => {
    fetchBookings();
  }, []);


  const fetchBookings =
    async () => {

      setLoading(true);
      setErrorMessage("");


      const {
        data,
        error,
      } = await supabase
        .from("bookings")
        .select("*")
        .order(
          "booking_date",
          {
            ascending: true,
          }
        )
        .order(
          "start_time",
          {
            ascending: true,
          }
        );


      if (error) {

        console.error(
          error
        );

        setErrorMessage(
          "Gagal mengambil data booking."
        );

        setBookings([]);

      } else {

        setBookings(
          data || []
        );

      }


      setLoading(false);
    };


  /* ==================================================
     FORMAT NUMBER
  ================================================== */

  const formatNumber =
    (value) => {

      if (
        value === null ||
        value === undefined ||
        value === ""
      ) {
        return "";
      }


      const number =
        String(value).replace(
          /\D/g,
          ""
        );


      if (!number) {
        return "";
      }


      return Number(
        number
      ).toLocaleString(
        "id-ID"
      );

    };


  const formatCurrency =
    (value) => {

      if (
        value === null ||
        value === undefined ||
        value === ""
      ) {
        return "-";
      }


      return `Rp ${Number(
        value
      ).toLocaleString(
        "id-ID"
      )}`;

    };


  /* ==================================================
     DATE
  ================================================== */

  const formatDate =
    (date) => {

      if (!date) {
        return "-";
      }


      const parsedDate =
        new Date(
          `${date}T00:00:00`
        );


      return parsedDate.toLocaleDateString(
        "id-ID",
        {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }
      );

    };


  /* ==================================================
     TIME
  ================================================== */

  const formatTime =
    (time) => {

      if (!time) {
        return "-";
      }


      return time.substring(
        0,
        5
      );

    };


  /* ==================================================
     TIME OPTIONS - 30 MINUTES
  ================================================== */

  const timeOptions = [];

  for (
    let hour = 0;
    hour < 24;
    hour++
  ) {

    for (
      let minute = 0;
      minute < 60;
      minute += 30
    ) {

      const formattedHour =
        String(hour).padStart(
          2,
          "0"
        );

      const formattedMinute =
        String(minute).padStart(
          2,
          "0"
        );

      timeOptions.push(
        `${formattedHour}:${formattedMinute}`
      );

    }

  }


  /* ==================================================
     FORM CHANGE
  ================================================== */

  const handleFormChange =
    (event) => {

      const {
        name,
        value,
      } = event.target;


      if (
        name ===
        "downPayment"
      ) {

        setForm(
          (current) => ({
            ...current,
            [name]:
              formatNumber(
                value
              ),
          })
        );

        return;
      }


      setForm(
        (current) => ({
          ...current,
          [name]: value,
        })
      );

    };


  /* ==================================================
     RESET FORM
  ================================================== */

  const resetForm = () => {

    setForm({

      customerName: "",
      bookingDate: "",
      startTime: "",
      packageName: "",
      status: "Complete",
      notes: "",
      downPayment: "",

    });

    setEditingBooking(
      null
    );

  };


  /* ==================================================
     ADD
  ================================================== */

  const openAddForm = () => {

    resetForm();

    setErrorMessage("");

    setShowView(false);

    setShowForm(true);

  };


  /* ==================================================
     EDIT
  ================================================== */

  const openEditForm =
    (booking) => {

      setEditingBooking(
        booking
      );


      setForm({

        customerName:
          booking.customer_name ||
          "",

        bookingDate:
          booking.booking_date ||
          "",

        startTime:
          booking.start_time
            ? booking.start_time.substring(
                0,
                5
              )
            : "",

        packageName:
          booking.package ||
          "",

        status:
          booking.status ||
          "Complete",

        notes:
          booking.notes ||
          "",

        downPayment:
          booking.down_payment
            ? formatNumber(
                booking.down_payment
              )
            : "",

      });


      setErrorMessage("");

      setShowView(false);

      setShowForm(true);

    };


  /* ==================================================
     VIEW
  ================================================== */

  const openViewBooking =
    (booking) => {

      setViewingBooking(
        booking
      );

      setShowView(true);

    };


  /* ==================================================
     SAVE
  ================================================== */

  const handleSubmit =
    async (event) => {

      event.preventDefault();

      setSaving(true);
      setErrorMessage("");


      if (
        !form.customerName.trim() ||
        !form.bookingDate ||
        !form.startTime ||
        !form.packageName.trim()
      ) {

        setErrorMessage(
          "Nama customer, tanggal, waktu mulai, dan package wajib diisi."
        );

        setSaving(false);

        return;
      }


      const downPaymentValue =
        form.downPayment
          ? Number(
              form.downPayment.replace(
                /\D/g,
                ""
              )
            )
          : 0;


      const bookingData = {

        customer_name:
          form.customerName.trim(),

        booking_date:
          form.bookingDate,

        start_time:
          form.startTime,

        package:
          form.packageName.trim(),

        status:
          form.status,

        notes:
          form.notes ||
          null,

        down_payment:
          downPaymentValue,

      };


      /* ==================================================
         EDIT
      ================================================== */

      if (
        editingBooking
      ) {

        const {
          data,
          error,
        } = await supabase
          .from("bookings")
          .update(
            bookingData
          )
          .eq(
            "id",
            editingBooking.id
          )
          .select()
          .single();


        if (error) {

          console.error(
            error
          );

          setErrorMessage(
            error.message ||
              "Gagal memperbarui booking."
          );

          setSaving(false);

          return;
        }


        setBookings(
          (current) =>
            current.map(
              (booking) =>
                booking.id ===
                editingBooking.id
                  ? data
                  : booking
            )
        );

      }


      /* ==================================================
         ADD
      ================================================== */

      else {

        const {
          data,
          error,
        } = await supabase
          .from("bookings")
          .insert([
            {
              ...bookingData,
              customer_id:
                null,
            },
          ])
          .select()
          .single();


        if (error) {

          console.error(
            error
          );

          setErrorMessage(
            error.message ||
              "Gagal menyimpan booking."
          );

          setSaving(false);

          return;
        }


        setBookings(
          (current) => [
            ...current,
            data,
          ]
        );

      }


      resetForm();

      setShowForm(false);

      setSaving(false);

    };


  /* ==================================================
     DELETE
  ================================================== */

  const handleDeleteBooking =
    async (id) => {

      const confirmed =
        window.confirm(
          "Hapus booking ini?\n\nData yang sudah dihapus tidak dapat dikembalikan."
        );


      if (!confirmed) {
        return;
      }


      setErrorMessage("");


      const {
        error,
      } = await supabase
        .from("bookings")
        .delete()
        .eq(
          "id",
          id
        );


      if (error) {

        console.error(
          error
        );

        setErrorMessage(
          "Gagal menghapus booking."
        );

        return;
      }


      setBookings(
        (current) =>
          current.filter(
            (booking) =>
              booking.id !== id
          )
      );


      if (
        viewingBooking &&
        viewingBooking.id === id
      ) {

        setShowView(false);

        setViewingBooking(
          null
        );

      }

    };


  /* ==================================================
     LOGOUT
  ================================================== */

  const handleLogout =
    async () => {

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


  /* ==================================================
     PERIOD FILTER
  ================================================== */

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


  const bookingYears =
    bookings
      .map(
        (booking) =>
          booking.booking_date
            ? booking.booking_date.substring(
                0,
                4
              )
            : null
      )
      .filter(Boolean);


  const currentYear =
    new Date().getFullYear();


  const yearOptions =
    Array.from(
      new Set([
        String(
          currentYear - 2
        ),
        String(
          currentYear - 1
        ),
        String(
          currentYear
        ),
        String(
          currentYear + 1
        ),
        String(
          currentYear + 2
        ),
        ...bookingYears,
      ])
    ).sort();


  const periodBookings =
    bookings.filter(
      (booking) => {

        if (
          !booking.booking_date
        ) {
          return false;
        }


        const [
          year,
          month,
        ] =
          booking.booking_date.split(
            "-"
          );


        if (
          periodFilter.type ===
          "date"
        ) {

          return (
            booking.booking_date ===
            periodFilter.date
          );

        }


        if (
          periodFilter.type ===
          "month"
        ) {

          return (
            year ===
              periodFilter.year &&
            month ===
              periodFilter.month
          );

        }


        return (
          year ===
          periodFilter.year
        );

      }
    );


  const periodLabel =
    periodFilter.type ===
    "date"
      ? formatDate(
          periodFilter.date
        )
      : periodFilter.type ===
        "month"
      ? `${
          monthNames[
            Number(
              periodFilter.month
            ) - 1
          ] || "-"
        } ${periodFilter.year}`
      : periodFilter.year;


  const updatePeriodFilter =
    (field, value) => {

      setPeriodFilter(
        (current) => ({
          ...current,
          [field]: value,
        })
      );

      setShareCopied(
        false
      );

    };


  /* ==================================================
     SYNC PERIOD TO URL
  ================================================== */

  useEffect(() => {

    const params =
      new URLSearchParams(
        window.location.search
      );


    params.delete(
      "date"
    );

    params.delete(
      "month"
    );

    params.delete(
      "year"
    );


    params.set(
      "period",
      periodFilter.type
    );


    if (
      periodFilter.type ===
      "date"
    ) {

      params.set(
        "date",
        periodFilter.date
      );

    }


    if (
      periodFilter.type ===
      "month"
    ) {

      params.set(
        "month",
        periodFilter.month
      );

      params.set(
        "year",
        periodFilter.year
      );

    }


    if (
      periodFilter.type ===
      "year"
    ) {

      params.set(
        "year",
        periodFilter.year
      );

    }


    const queryString =
      params.toString();

    const nextUrl =
      `${window.location.pathname}${
        queryString
          ? `?${queryString}`
          : ""
      }${window.location.hash}`;


    window.history.replaceState(
      null,
      "",
      nextUrl
    );

  }, [
    periodFilter.type,
    periodFilter.date,
    periodFilter.month,
    periodFilter.year,
  ]);


  /* ==================================================
     SHARE FILTERED BOOKING LINK
  ================================================== */

  const handleShare =
    async () => {

      const shareUrl =
        window.location.href;


      try {

        if (
          navigator.clipboard &&
          window.isSecureContext
        ) {

          await navigator.clipboard.writeText(
            shareUrl
          );

        } else {

          const textarea =
            document.createElement(
              "textarea"
            );

          textarea.value =
            shareUrl;

          textarea.style.position =
            "fixed";

          textarea.style.opacity =
            "0";

          document.body.appendChild(
            textarea
          );

          textarea.focus();
          textarea.select();

          document.execCommand(
            "copy"
          );

          document.body.removeChild(
            textarea
          );

        }


        setShareCopied(
          true
        );

        window.setTimeout(
          () => {
            setShareCopied(
              false
            );
          },
          1800
        );

      } catch (error) {

        console.error(
          "Gagal menyalin link booking:",
          error
        );

        setErrorMessage(
          "Gagal menyalin link booking."
        );

      }

    };


  /* ==================================================
     SEARCH
  ================================================== */

  const filteredBookings =
    periodBookings.filter(
      (booking) => {

        const keyword =
          search
            .toLowerCase()
            .trim();


        if (!keyword) {
          return true;
        }


        const customerName =
          booking.customer_name ||
          "";

        const packageName =
          booking.package ||
          "";

        const status =
          booking.status ||
          "";


        return (
          customerName
            .toLowerCase()
            .includes(
              keyword
            ) ||
          packageName
            .toLowerCase()
            .includes(
              keyword
            ) ||
          status
            .toLowerCase()
            .includes(
              keyword
            )
        );

      }
    );


  /* ==================================================
     PAGINATION
  ================================================== */

  const totalPages =
    Math.ceil(
      filteredBookings.length /
        BOOKINGS_PER_PAGE
    );


  const safeCurrentPage =
    totalPages === 0
      ? 0
      : Math.min(
          currentPage,
          totalPages - 1
        );


  const visibleBookings =
    filteredBookings.slice(
      safeCurrentPage *
        BOOKINGS_PER_PAGE,
      safeCurrentPage *
        BOOKINGS_PER_PAGE +
        BOOKINGS_PER_PAGE
    );


  const goPrevious =
    () => {

      setCurrentPage(
        (current) =>
          Math.max(
            current - 1,
            0
          )
      );

    };


  const goNext =
    () => {

      setCurrentPage(
        (current) =>
          Math.min(
            current + 1,
            Math.max(
              totalPages - 1,
              0
            )
          )
      );

    };


  /* Reset halaman ketika search berubah */

  useEffect(() => {
    setCurrentPage(0);
  }, [
    search,
    periodFilter.type,
    periodFilter.date,
    periodFilter.month,
    periodFilter.year,
  ]);


  return (

    <div className="booking-page">


      <Sidebar
        activePage="booking"
      />


      <main className="booking-main">


        {/* ==================================================
            PAGE HEADER
        ================================================== */}

        <div className="booking-page-header">

          <div>

            <div className="booking-eyebrow">
              PLUNO STUDIO / OPERATIONS
            </div>

            <h1>
              Booking List
            </h1>

          </div>


          <div className="booking-header-actions">


            <div className="booking-period-filter">

              <select
                className="booking-period-type"
                value={
                  periodFilter.type
                }
                onChange={(
                  event
                ) =>
                  updatePeriodFilter(
                    "type",
                    event.target.value
                  )
                }
                aria-label="Booking period type"
              >

                <option value="date">
                  Date
                </option>

                <option value="month">
                  Month
                </option>

                <option value="year">
                  Year
                </option>

              </select>


              {periodFilter.type ===
                "date" && (

                <input
                  type="date"
                  className="booking-period-date"
                  value={
                    periodFilter.date
                  }
                  onChange={(
                    event
                  ) =>
                    updatePeriodFilter(
                      "date",
                      event.target.value
                    )
                  }
                  aria-label="Booking date"
                />

              )}


              {periodFilter.type ===
                "month" && (

                <>

                  <select
                    value={
                      periodFilter.month
                    }
                    onChange={(
                      event
                    ) =>
                      updatePeriodFilter(
                        "month",
                        event.target.value
                      )
                    }
                    aria-label="Booking month"
                  >

                    {monthNames.map(
                      (
                        month,
                        index
                      ) => (

                        <option
                          key={month}
                          value={String(
                            index + 1
                          ).padStart(
                            2,
                            "0"
                          )}
                        >
                          {month}
                        </option>

                      )
                    )}

                  </select>


                  <select
                    value={
                      periodFilter.year
                    }
                    onChange={(
                      event
                    ) =>
                      updatePeriodFilter(
                        "year",
                        event.target.value
                      )
                    }
                    aria-label="Booking year"
                  >

                    {yearOptions.map(
                      (year) => (

                        <option
                          key={year}
                          value={year}
                        >
                          {year}
                        </option>

                      )
                    )}

                  </select>

                </>

              )}


              {periodFilter.type ===
                "year" && (

                <select
                  value={
                    periodFilter.year
                  }
                  onChange={(
                    event
                  ) =>
                    updatePeriodFilter(
                      "year",
                      event.target.value
                    )
                  }
                  aria-label="Booking year"
                >

                  {yearOptions.map(
                    (year) => (

                      <option
                        key={year}
                        value={year}
                      >
                        {year}
                      </option>

                    )
                  )}

                </select>

              )}

            </div>


            <button
              type="button"
              className={`booking-share-button ${
                shareCopied
                  ? "copied"
                  : ""
              }`}
              onClick={
                handleShare
              }
            >
              {shareCopied
                ? "Copied"
                : "Share"}
            </button>


            <button
              type="button"
              className="booking-add-button"
              onClick={
                openAddForm
              }
            >
              Add
            </button>

          </div>

        </div>


        {errorMessage && (

          <div className="booking-error">
            {errorMessage}
          </div>

        )}


        <section className="booking-list-section">


          <div className="booking-list-header">

            <div className="booking-section-label">
              BOOKING DATABASE
            </div>


            <div className="booking-list-tools">

              <div className="booking-active-period">
                {periodLabel}
              </div>


              <div className="booking-count">
                {filteredBookings.length} BOOKING
              </div>


              <div className="booking-search">

                <span>
                  /
                </span>

                <input
                  type="text"
                  placeholder="Search..."
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

            </div>

          </div>


          <div className="booking-table-scroll">

            <table className="booking-table">

              <thead>

                <tr>

                  <th>
                    CUSTOMER
                  </th>

                  <th>
                    DATE
                  </th>

                  <th>
                    TIME
                  </th>

                  <th>
                    PACKAGE
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
                      colSpan="6"
                      className="booking-empty"
                    >
                      Loading booking...
                    </td>

                  </tr>

                ) : visibleBookings.length ===
                  0 ? (

                  <tr>

                    <td
                      colSpan="6"
                      className="booking-empty"
                    >
                      No booking found.
                    </td>

                  </tr>

                ) : (

                  visibleBookings.map(
                    (booking) => (

                      <tr
                        key={
                          booking.id
                        }
                      >

                        <td>

                          <div className="booking-customer-name">
                            {booking.customer_name ||
                              "Unnamed Customer"}
                          </div>

                        </td>


                        <td>
                          {formatDate(
                            booking.booking_date
                          )}
                        </td>


                        <td>
                          {formatTime(
                            booking.start_time
                          )}
                        </td>


                        <td>

                          <div className="booking-package">
                            {booking.package ||
                              "-"}
                          </div>

                        </td>


                        <td>

                          <span
                            className={`booking-status ${
                              booking.status ===
                              "Complete"
                                ? "booking-status-complete"
                                : "booking-status-canceled"
                            }`}
                          >
                            {booking.status}
                          </span>

                        </td>


                        <td>

                          <div className="booking-actions">

                            <button
                              type="button"
                              className="view"
                              onClick={() =>
                                openViewBooking(
                                  booking
                                )
                              }
                            >
                              View
                            </button>


                            <button
                              type="button"
                              className="edit"
                              onClick={() =>
                                openEditForm(
                                  booking
                                )
                              }
                            >
                              Edit
                            </button>


                            <button
                              type="button"
                              className="delete"
                              onClick={() =>
                                handleDeleteBooking(
                                  booking.id
                                )
                              }
                            >
                              Delete
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


          {/* ==================================================
              PAGINATION
          ================================================== */}

          {totalPages > 1 && (

            <div className="booking-pagination">

              <button
                type="button"
                className="booking-page-arrow"
                onClick={
                  goPrevious
                }
                disabled={
                  safeCurrentPage === 0
                }
                aria-label="Previous bookings"
              >
                ←
              </button>


              <span className="booking-page-indicator">
                {safeCurrentPage + 1}
                <span>
                  /
                </span>
                {totalPages}
              </span>


              <button
                type="button"
                className="booking-page-arrow"
                onClick={
                  goNext
                }
                disabled={
                  safeCurrentPage >=
                  totalPages - 1
                }
                aria-label="Next bookings"
              >
                →
              </button>

            </div>

          )}

        </section>


        <footer className="booking-footer">

          <span>
            PLUNO INTERNAL SYSTEM
          </span>

          <span>
            v1.0 · 2026
          </span>

        </footer>

      </main>


      {/* ==================================================
          ADD / EDIT MODAL
      ================================================== */}

      {showForm && (

        <div
          className="booking-overlay"
          onMouseDown={(
            event
          ) => {

            if (
              event.target ===
              event.currentTarget
            ) {

              setShowForm(
                false
              );

              resetForm();

            }

          }}
        >

          <div className="booking-form-box">


            <div className="booking-form-header">

              <div>

                <div className="booking-form-kicker">

                  {editingBooking
                    ? "EDIT BOOKING"
                    : "NEW BOOKING"}

                </div>


                <h2>

                  {editingBooking
                    ? "Edit Booking"
                    : "Add Booking"}

                </h2>


                <p>

                  {editingBooking
                    ? "Update booking information."
                    : "Create a new booking record."}

                </p>

              </div>


              <button
                type="button"
                className="booking-close"
                onClick={() => {

                  setShowForm(
                    false
                  );

                  resetForm();

                }}
              >
                ×
              </button>

            </div>


            <form
              onSubmit={
                handleSubmit
              }
            >

              <div className="booking-form-grid">


                <div className="booking-field">

                  <label>
                    CUSTOMER
                  </label>

                  <input
                    type="text"
                    name="customerName"
                    placeholder="Customer name"
                    value={
                      form.customerName
                    }
                    onChange={
                      handleFormChange
                    }
                    required
                  />

                </div>


                <div className="booking-field">

                  <label>
                    PACKAGE
                  </label>

                  <input
                    type="text"
                    name="packageName"
                    placeholder="Package description"
                    value={
                      form.packageName
                    }
                    onChange={
                      handleFormChange
                    }
                    required
                  />

                </div>


                <div className="booking-field">

                  <label>
                    BOOKING DATE
                  </label>

                  <input
                    type="date"
                    name="bookingDate"
                    value={
                      form.bookingDate
                    }
                    onChange={
                      handleFormChange
                    }
                    required
                  />

                </div>


                <div className="booking-field">

                  <label>
                    START TIME
                  </label>

                  <select
                    name="startTime"
                    value={
                      form.startTime
                    }
                    onChange={
                      handleFormChange
                    }
                    required
                  >

                    <option value="">
                      Select time
                    </option>

                    {timeOptions.map(
                      (time) => (

                        <option
                          key={time}
                          value={time}
                        >
                          {time}
                        </option>

                      )
                    )}

                  </select>

                </div>


                <div className="booking-field">

                  <label>
                    DOWN PAYMENT
                  </label>

                  <input
                    type="text"
                    name="downPayment"
                    inputMode="numeric"
                    placeholder="Rp 0"
                    value={
                      form.downPayment
                    }
                    onChange={
                      handleFormChange
                    }
                  />

                </div>


                <div className="booking-field">

                  <label>
                    STATUS
                  </label>

                  <select
                    name="status"
                    value={
                      form.status
                    }
                    onChange={
                      handleFormChange
                    }
                  >

                    <option value="Complete">
                      Complete
                    </option>

                    <option value="Canceled">
                      Canceled
                    </option>

                  </select>

                </div>

              </div>


              <div className="booking-field booking-notes-field">

                <label>
                  NOTES
                </label>

                <textarea
                  name="notes"
                  rows="4"
                  placeholder="Additional notes..."
                  value={
                    form.notes
                  }
                  onChange={
                    handleFormChange
                  }
                />

              </div>


              {errorMessage && (

                <div className="booking-form-error">
                  {errorMessage}
                </div>

              )}


              <div className="booking-form-footer">

                <button
                  type="button"
                  className="booking-cancel"
                  onClick={() => {

                    setShowForm(
                      false
                    );

                    resetForm();

                  }}
                >
                  Cancel
                </button>


                <button
                  type="submit"
                  className="booking-save"
                  disabled={
                    saving
                  }
                >

                  {saving
                    ? "Saving..."
                    : editingBooking
                    ? "Update Booking"
                    : "Save Booking"}

                </button>

              </div>

            </form>

          </div>

        </div>

      )}


      {/* ==================================================
          VIEW MODAL
      ================================================== */}

      {showView &&
        viewingBooking && (

        <div
          className="booking-overlay"
          onMouseDown={(
            event
          ) => {

            if (
              event.target ===
              event.currentTarget
            ) {

              setShowView(
                false
              );

              setViewingBooking(
                null
              );

            }

          }}
        >

          <div className="booking-view-box">


            <div className="booking-form-header">

              <div>

                <div className="booking-form-kicker">
                  BOOKING DETAIL
                </div>

                <h2>
                  {
                    viewingBooking.customer_name ||
                    "Unnamed Customer"
                  }
                </h2>

                <p>
                  Booking information
                </p>

              </div>


              <button
                type="button"
                className="booking-close"
                onClick={() => {

                  setShowView(
                    false
                  );

                  setViewingBooking(
                    null
                  );

                }}
              >
                ×
              </button>

            </div>


            <div className="booking-detail-grid">


              <div className="booking-detail-item">

                <span>
                  CUSTOMER
                </span>

                <strong>
                  {
                    viewingBooking.customer_name ||
                    "-"
                  }
                </strong>

              </div>


              <div className="booking-detail-item">

                <span>
                  PACKAGE
                </span>

                <strong>
                  {
                    viewingBooking.package ||
                    "-"
                  }
                </strong>

              </div>


              <div className="booking-detail-item">

                <span>
                  BOOKING DATE
                </span>

                <strong>
                  {formatDate(
                    viewingBooking.booking_date
                  )}
                </strong>

              </div>


              <div className="booking-detail-item">

                <span>
                  START TIME
                </span>

                <strong>
                  {formatTime(
                    viewingBooking.start_time
                  )}
                </strong>

              </div>


              <div className="booking-detail-item">

                <span>
                  DOWN PAYMENT
                </span>

                <strong>
                  {formatCurrency(
                    viewingBooking.down_payment
                  )}
                </strong>

              </div>


              <div className="booking-detail-item">

                <span>
                  STATUS
                </span>

                <strong>

                  <span
                    className={`booking-status ${
                      viewingBooking.status ===
                      "Complete"
                        ? "booking-status-complete"
                        : "booking-status-canceled"
                    }`}
                  >
                    {
                      viewingBooking.status ||
                      "-"
                    }
                  </span>

                </strong>

              </div>

            </div>


            <div className="booking-detail-notes">

              <span>
                NOTES
              </span>

              <p>
                {
                  viewingBooking.notes ||
                  "No notes."
                }
              </p>

            </div>


            <div className="booking-view-footer">

              <button
                type="button"
                className="booking-cancel"
                onClick={() => {

                  setShowView(
                    false
                  );

                  setViewingBooking(
                    null
                  );

                }}
              >
                Close
              </button>


              <button
                type="button"
                className="booking-save"
                onClick={() =>
                  openEditForm(
                    viewingBooking
                  )
                }
              >
                Edit Booking
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}


export default Booking;