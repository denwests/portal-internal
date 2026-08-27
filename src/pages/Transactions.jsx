import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "../supabase";
import Sidebar from "../components/Sidebar";
import "./Transactions.css";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";


/* =========================================================
   FORMAT RUPIAH
========================================================= */

function formatRupiah(value) {
  return `Rp ${Number(
    value || 0
  ).toLocaleString("id-ID")}`;
}


/* =========================================================
   FORMAT DATE
========================================================= */

function formatDate(date) {
  if (!date) return "-";

  const [
    year,
    month,
    day,
  ] = date.split("-");

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

  return `${day} ${
    months[Number(month) - 1]
  } ${year}`;
}


/* =========================================================
   TODAY
========================================================= */

function getTodayString() {
  const today = new Date();

  return `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(
    2,
    "0"
  )}-${String(
    today.getDate()
  ).padStart(
    2,
    "0"
  )}`;
}


/* =========================================================
   MDR STORAGE
========================================================= */

const MDR_STORAGE_KEY =
  "pluno_qris_mdr_percentage";

const DEFAULT_MDR_PERCENTAGE =
  0.7;


/* =========================================================
   READ MDR SETTING
========================================================= */

function getStoredMdrPercentage() {
  const storedValue =
    window.localStorage.getItem(
      MDR_STORAGE_KEY
    );

  if (
    storedValue === null ||
    storedValue === ""
  ) {
    return DEFAULT_MDR_PERCENTAGE;
  }

  const value =
    Number(
      storedValue
    );

  if (
    Number.isNaN(value) ||
    value < 0 ||
    value > 100
  ) {
    return DEFAULT_MDR_PERCENTAGE;
  }

  return value;
}


/* =========================================================
   TRANSACTIONS COMPONENT
========================================================= */

function Transactions() {

  /* =======================================================
     STATE
  ======================================================= */

  const [
    transactions,
    setTransactions,
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
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    showAddModal,
    setShowAddModal,
  ] = useState(false);

  const [
    showMdrSettings,
    setShowMdrSettings,
  ] = useState(false);

  const [
    mdrPercentage,
    setMdrPercentage,
  ] = useState(
    getStoredMdrPercentage()
  );

  const [
    mdrFormValue,
    setMdrFormValue,
  ] = useState(
    String(
      getStoredMdrPercentage()
    )
  );

  const [
    selectedMonth,
    setSelectedMonth,
  ] = useState(
    String(
      new Date().getMonth() + 1
    ).padStart(
      2,
      "0"
    )
  );

  const [
    selectedYear,
    setSelectedYear,
  ] = useState(
    String(
      new Date().getFullYear()
    )
  );


  /* =======================================================
     FORM DATA
  ======================================================= */

  const [
    formData,
    setFormData,
  ] = useState({
    transaction_date:
      getTodayString(),

    customer:
      "",

    payment_type:
      "Down Payment",

    description:
      "",

    amount:
      "",

    payment_method:
      "Cash",

    information:
      "",
  });


  /* =======================================================
     MONTH NAMES
  ======================================================= */

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


  /* =======================================================
     YEAR OPTIONS
  ======================================================= */

  const currentYear =
    new Date().getFullYear();

  const yearOptions = [];

  for (
    let year =
      currentYear - 5;
    year <=
      currentYear + 5;
    year++
  ) {
    yearOptions.push(
      String(year)
    );
  }


  /* =======================================================
     FETCH TRANSACTIONS
  ======================================================= */

  const fetchTransactions =
    async () => {

      setLoading(true);
      setErrorMessage("");

      const {
        data,
        error,
      } =
        await supabase
          .from("transactions")
          .select("*")
          .order(
            "transaction_date",
            {
              ascending:
                false,
            }
          )
          .order(
            "created_at",
            {
              ascending:
                false,
            }
          );

      if (error) {

        console.error(
          "TRANSACTION FETCH ERROR:",
          error
        );

        setErrorMessage(
          `Gagal mengambil transaksi: ${error.message}`
        );

        setTransactions([]);

        setLoading(false);

        return;
      }

      setTransactions(
        data || []
      );

      setLoading(false);
    };


  useEffect(() => {
    fetchTransactions();
  }, []);


  /* =======================================================
     MDR SETTINGS
  ======================================================= */

  const openMdrSettings =
    () => {

      setMdrFormValue(
        String(
          mdrPercentage
        )
      );

      setErrorMessage("");

      setShowMdrSettings(
        true
      );
    };


  const closeMdrSettings =
    () => {

      if (saving) {
        return;
      }

      setShowMdrSettings(
        false
      );

      setErrorMessage("");
    };


  const handleMdrChange =
    (event) => {

      const value =
        event.target.value;

      if (
        value === ""
      ) {
        setMdrFormValue(
          ""
        );

        return;
      }

      const numericValue =
        Number(
          value
        );

      if (
        Number.isNaN(
          numericValue
        )
      ) {
        return;
      }

      if (
        numericValue < 0 ||
        numericValue > 100
      ) {
        return;
      }

      setMdrFormValue(
        value
      );
    };


  const saveMdrSettings =
    () => {

      const value =
        Number(
          mdrFormValue
        );

      if (
        Number.isNaN(
          value
        ) ||
        value < 0 ||
        value > 100
      ) {

        setErrorMessage(
          "QRIS MDR harus berada di antara 0% sampai 100%."
        );

        return;
      }

      setMdrPercentage(
        value
      );

      window.localStorage.setItem(
        MDR_STORAGE_KEY,
        String(
          value
        )
      );

      setErrorMessage("");

      setShowMdrSettings(
        false
      );
    };


  /* =======================================================
     ACTIVE YEAR
  ======================================================= */

  const activeYear =
    selectedYear;


  /* =======================================================
     ACTIVE MONTH
  ======================================================= */

  const activeMonth =
    selectedMonth;


  /* =======================================================
     FILTER TRANSACTIONS
  ======================================================= */

  const filteredTransactions =
    useMemo(() => {

      return transactions.filter(
        (item) => {

          if (
            !item.transaction_date
          ) {
            return false;
          }

          return (
            item.transaction_date.slice(
              0,
              4
            ) ===
              activeYear &&
            item.transaction_date.slice(
              5,
              7
            ) ===
              activeMonth
          );
        }
      );

    }, [
      transactions,
      activeMonth,
      activeYear,
    ]);


  /* =======================================================
     SUMMARY
  ======================================================= */

  const totalTransaction =
    filteredTransactions.length;


  const totalGross =
    filteredTransactions.reduce(
      (
        total,
        item
      ) =>
        total +
        Number(
          item.amount ||
            0
        ),
      0
    );


  const totalMDR =
    filteredTransactions.reduce(
      (
        total,
        item
      ) =>
        total +
        Number(
          item.mdr_amount ||
            0
        ),
      0
    );


  const totalNet =
    filteredTransactions.reduce(
      (
        total,
        item
      ) =>
        total +
        Number(
          item.net_amount ||
            0
        ),
      0
    );


  /* =======================================================
     OPEN ADD MODAL
  ======================================================= */

  const openAddModal =
    () => {

      setFormData({
        transaction_date:
          getTodayString(),

        customer:
          "",

        payment_type:
          "Down Payment",

        description:
          "",

        amount:
          "",

        payment_method:
          "Cash",

        information:
          "",
      });

      setErrorMessage("");

      setShowAddModal(
        true
      );
    };


  /* =======================================================
     CLOSE ADD MODAL
  ======================================================= */

  const closeAddModal =
    () => {

      if (saving) {
        return;
      }

      setShowAddModal(
        false
      );

      setErrorMessage("");
    };


  /* =======================================================
     FORM CHANGE
  ======================================================= */

  const handleFormChange =
    (event) => {

      const {
        name,
        value,
      } = event.target;

      setFormData(
        (current) => ({
          ...current,
          [name]:
            value,
        })
      );
    };


  /* =======================================================
     AMOUNT CHANGE
  ======================================================= */

  const handleAmountChange =
    (event) => {

      const numericValue =
        event.target.value.replace(
          /\D/g,
          ""
        );

      setFormData(
        (current) => ({
          ...current,

          amount:
            numericValue,
        })
      );
    };


  /* =======================================================
     SAVE TRANSACTION
  ======================================================= */

  const handleSubmit =
    async (
      event
    ) => {

      event.preventDefault();

      setErrorMessage("");

      const amount =
        Number(
          formData.amount ||
            0
        );


      if (
        !formData.transaction_date ||
        !formData.customer.trim() ||
        !formData.description.trim() ||
        amount <= 0
      ) {

        setErrorMessage(
          "Tanggal, customer, deskripsi, dan nominal wajib diisi."
        );

        return;
      }


      setSaving(
        true
      );


      /* ===================================================
         MDR
      =================================================== */

      const currentMdrPercentage =
        formData.payment_method ===
        "QRIS"
          ? Number(
              mdrPercentage
            )
          : 0;


      const mdrAmount =
        Math.round(
          amount *
            (
              currentMdrPercentage /
              100
            )
        );


      const netAmount =
        amount -
        mdrAmount;


      /* ===================================================
         INSERT
      =================================================== */

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "transactions"
          )
          .insert([
            {
              transaction_date:
                formData.transaction_date,

              customer:
                formData.customer.trim(),

              payment_type:
                formData.payment_type,

              description:
                formData.description.trim(),

              amount,

              payment_method:
                formData.payment_method,

              mdr_percentage:
                currentMdrPercentage,

              mdr_amount:
                mdrAmount,

              net_amount:
                netAmount,

              information:
                formData.information.trim() ||
                null,
            },
          ])
          .select()
          .single();


      if (error) {

        console.error(
          "INSERT TRANSACTION ERROR:",
          error
        );

        setErrorMessage(
          `Gagal menyimpan transaksi: ${error.message}`
        );

        setSaving(
          false
        );

        return;
      }


      setTransactions(
        (current) => [
          data,
          ...current,
        ]
      );


      /* ===================================================
         SET FILTER KE TRANSAKSI BARU
      =================================================== */

      if (
        data.transaction_date
      ) {

        setSelectedYear(
          data.transaction_date.slice(
            0,
            4
          )
        );

        setSelectedMonth(
          data.transaction_date.slice(
            5,
            7
          )
        );
      }


      setSaving(
        false
      );

      setShowAddModal(
        false
      );
    };


  /* =======================================================
     DELETE
  ======================================================= */

  const handleDelete =
    async (
      item
    ) => {

      const confirmed =
        window.confirm(
          `Hapus transaksi "${item.description}"?`
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
            "transactions"
          )
          .delete()
          .eq(
            "id",
            item.id
          );

      if (error) {

        console.error(
          "DELETE TRANSACTION ERROR:",
          error
        );

        setErrorMessage(
          `Gagal menghapus transaksi: ${error.message}`
        );

        return;
      }

      setTransactions(
        (current) =>
          current.filter(
            (
              transaction
            ) =>
              transaction.id !==
              item.id
          )
      );
    };


  /* =======================================================
     DOWNLOAD PDF
  ======================================================= */

  const handleDownloadPDF =
    () => {

      if (
        filteredTransactions.length ===
        0
      ) {

        window.alert(
          `Tidak ada transaksi untuk ${
            monthNames[
              Number(
                activeMonth
              ) - 1
            ]
          } ${activeYear}.`
        );

        return;
      }


      const doc =
        new jsPDF({
          orientation:
            "landscape",

          unit:
            "mm",

          format:
            "a4",
        });


      /* ===================================================
         DOCUMENT TITLE
      =================================================== */

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.setFontSize(
        8
      );

      doc.setTextColor(
        100,
        100,
        100
      );

      doc.text(
        "PLUNO INTERNAL SYSTEM",
        14,
        14
      );


      doc.setFontSize(
        20
      );

      doc.setTextColor(
        30,
        30,
        30
      );

      doc.text(
        "Transaction Performance",
        14,
        24
      );


      doc.setFontSize(
        9
      );

      doc.setTextColor(
        100,
        100,
        100
      );

      doc.text(
        `Transaction Report · ${
          monthNames[
            Number(
              activeMonth
            ) - 1
          ]
        } ${activeYear}`,
        14,
        31
      );


      /* ===================================================
         SUMMARY
      =================================================== */

      const summaryY =
        40;


      const summaryItems = [
        {
          label:
            "TRANSACTIONS",

          value:
            String(
              totalTransaction
            ),
        },

        {
          label:
            "GROSS",

          value:
            formatRupiah(
              totalGross
            ),
        },

        {
          label:
            "MDR",

          value:
            formatRupiah(
              totalMDR
            ),
        },

        {
          label:
            "NET",

          value:
            formatRupiah(
              totalNet
            ),
        },
      ];


      const summaryWidth =
        66;

      const summaryGap =
        4;


      summaryItems.forEach(
        (
          item,
          index
        ) => {

          const x =
            14 +
            index *
              (
                summaryWidth +
                summaryGap
              );


          doc.setDrawColor(
            220,
            220,
            220
          );

          doc.setFillColor(
            248,
            248,
            248
          );

          doc.rect(
            x,
            summaryY,
            summaryWidth,
            19,
            "FD"
          );


          doc.setFontSize(
            7
          );

          doc.setTextColor(
            110,
            110,
            110
          );

          doc.text(
            item.label,
            x + 5,
            summaryY + 7
          );


          doc.setFontSize(
            11
          );

          doc.setTextColor(
            30,
            30,
            30
          );

          doc.text(
            item.value,
            x + 5,
            summaryY + 14
          );
        }
      );


      /* ===================================================
         TABLE DATA
      =================================================== */

      const tableData =
        filteredTransactions.map(
          (
            item
          ) => [

            formatDate(
              item.transaction_date
            ),

            item.customer ||
              "-",

            item.payment_type ||
              "Down Payment",

            item.description ||
              "-",

            item.payment_method ||
              "-",

            formatRupiah(
              item.amount
            ),

            Number(
              item.mdr_percentage ||
                0
            ) > 0
              ? `${item.mdr_percentage}%`
              : "-",

            formatRupiah(
              item.net_amount
            ),
          ]
        );


      /* ===================================================
         TABLE
      =================================================== */

      autoTable(
        doc,
        {

          startY:
            66,

          head: [[
            "DATE",
            "CUSTOMER",
            "PAYMENT TYPE",
            "DESCRIPTION",
            "PAYMENT",
            "GROSS",
            "MDR",
            "NET",
          ]],

          body:
            tableData,

          theme:
            "grid",

          styles: {

            font:
              "helvetica",

            fontSize:
              7,

            fontStyle:
              "normal",

            textColor: [
              50,
              50,
              50,
            ],

            lineColor: [
              220,
              220,
              220,
            ],

            lineWidth:
              0.2,

            cellPadding:
              3,

            valign:
              "middle",
          },

          headStyles: {

            fillColor: [
              30,
              30,
              30,
            ],

            textColor: [
              240,
              240,
              240,
            ],

            fontSize:
              6.5,

            fontStyle:
              "normal",

            lineColor: [
              30,
              30,
              30,
            ],
          },

          alternateRowStyles: {

            fillColor: [
              248,
              248,
              248,
            ],
          },

          columnStyles: {

            0: {
              cellWidth:
                27,
            },

            1: {
              cellWidth:
                38,
            },

            2: {
              cellWidth:
                34,
            },

            3: {
              cellWidth:
                55,
            },

            4: {
              cellWidth:
                25,
            },

            5: {
              cellWidth:
                35,

              halign:
                "right",
            },

            6: {
              cellWidth:
                20,

              halign:
                "center",
            },

            7: {
              cellWidth:
                35,

              halign:
                "right",
            },
          },

          margin: {
            left:
              14,

            right:
              14,
          },
        }
      );


      /* ===================================================
         FOOTER
      =================================================== */

      const pageCount =
        doc.internal.getNumberOfPages();


      for (
        let page = 1;
        page <= pageCount;
        page++
      ) {

        doc.setPage(
          page
        );


        const pageHeight =
          doc.internal
            .pageSize
            .height;


        doc.setFontSize(
          6.5
        );

        doc.setTextColor(
          130,
          130,
          130
        );


        doc.text(
          "PLUNO INTERNAL SYSTEM",
          14,
          pageHeight - 8
        );


        doc.text(
          `Page ${page} / ${pageCount}`,
          283,
          pageHeight - 8,
          {
            align:
              "right",
          }
        );
      }


      /* ===================================================
         FILE NAME
      =================================================== */

      const monthName =
        monthNames[
          Number(
            activeMonth
          ) - 1
        ];


      doc.save(
        `Transactions-${monthName}-${activeYear}.pdf`
      );
    };


  /* =======================================================
     RENDER
  ======================================================= */

  return (

    <div className="transactions-page">


      {/* =================================================
          SIDEBAR
      ================================================= */}

      <Sidebar
        activePage="transactions"
      />


      {/* =================================================
          MAIN
      ================================================= */}

      <main className="transactions-main">


        {/* =================================================
            OVERVIEW
        ================================================= */}

        <div className="transactions-section-heading">

          <div>

            <div className="transactions-section-label">
              PLUNO STUDIO / FINANCIAL
            </div>

            <h2>
              Transaction Performance
            </h2>

          </div>


          <div className="transactions-performance-filter">

            {/* MONTH */}

            <select
              value={
                activeMonth
              }
              onChange={(
                event
              ) =>
                setSelectedMonth(
                  event.target.value
                )
              }
            >

              {monthNames.map(
                (
                  month,
                  index
                ) => (

                  <option
                    key={
                      month
                    }
                    value={String(
                      index + 1
                    ).padStart(
                      2,
                      "0"
                    )}
                  >
                    {
                      month
                    }
                  </option>

                )
              )}

            </select>


            {/* YEAR */}

            <select
              value={
                activeYear
              }
              onChange={(
                event
              ) =>
                setSelectedYear(
                  event.target.value
                )
              }
            >

              {yearOptions.map(
                (
                  year
                ) => (

                  <option
                    key={
                      year
                    }
                    value={
                      year
                    }
                  >
                    {
                      year
                    }
                  </option>

                )
              )}

            </select>


            {/* =================================================
                MDR SETTINGS
            ================================================= */}

            <button
              type="button"
              className="transactions-mdr-settings"
              onClick={
                openMdrSettings
              }
              aria-label="QRIS MDR Settings"
              title="QRIS MDR Settings"
              style={{
                width:
                  "30px",
                height:
                  "30px",
                padding:
                  0,
                border:
                  "1px solid #333",
                background:
                  "#111",
                color:
                  "#aaa",
                cursor:
                  "pointer",
                fontFamily:
                  "inherit",
                fontSize:
                  "14px",
                fontWeight:
                  400,
                lineHeight:
                  1,
                display:
                  "flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                transition:
                  "color 0.2s ease, border-color 0.2s ease, background 0.2s ease",
              }}
            >
              ⚙
            </button>

          </div>

        </div>


        {/* =================================================
            ERROR
        ================================================= */}

        {errorMessage && (

          <div className="transactions-error">
            {
              errorMessage
            }
          </div>

        )}


        {/* =================================================
            SUMMARY
        ================================================= */}

        <div className="transactions-summary">

          <div>

            <span>
              TRANSACTIONS
            </span>

            <strong>
              {
                totalTransaction
              }
            </strong>

          </div>


          <div>

            <span>
              GROSS
            </span>

            <strong>
              {formatRupiah(
                totalGross
              )}
            </strong>

          </div>


          <div>

            <span>
              MDR
            </span>

            <strong>
              {formatRupiah(
                totalMDR
              )}
            </strong>

          </div>


          <div>

            <span>
              NET
            </span>

            <strong>
              {formatRupiah(
                totalNet
              )}
            </strong>

          </div>

        </div>


        {/* =================================================
            TRANSACTION LIST
        ================================================= */}

        <section className="transactions-card">

          <div className="transactions-card-header">

            <div>

              <span>
                TRANSACTION LIST
              </span>

              <h2>
                Customer Transactions
              </h2>

            </div>


            <div className="transactions-header-actions">

              <button
                type="button"
                className="transactions-pdf-button"
                onClick={
                  handleDownloadPDF
                }
              >
                Download PDF
              </button>


              <button
                type="button"
                className="transactions-add-button"
                onClick={
                  openAddModal
                }
              >
                Add
              </button>

            </div>

          </div>


          <div className="transactions-table-scroll">

            <table className="transactions-table">

              <thead>

                <tr>

                  <th>
                    DATE
                  </th>

                  <th>
                    CUSTOMER
                  </th>

                  <th>
                    PAYMENT TYPE
                  </th>

                  <th>
                    DESCRIPTION
                  </th>

                  <th>
                    PAYMENT
                  </th>

                  <th>
                    GROSS
                  </th>

                  <th>
                    MDR
                  </th>

                  <th>
                    NET
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
                      colSpan="9"
                      className="transactions-empty"
                    >
                      Loading transactions...
                    </td>

                  </tr>

                ) : filteredTransactions.length === 0 ? (

                  <tr>

                    <td
                      colSpan="9"
                      className="transactions-empty"
                    >
                      No transactions found.
                    </td>

                  </tr>

                ) : (

                  filteredTransactions.map(
                    (
                      item
                    ) => (

                      <tr
                        key={
                          item.id
                        }
                      >

                        <td>
                          {formatDate(
                            item.transaction_date
                          )}
                        </td>


                        <td>
                          {
                            item.customer
                          }
                        </td>


                        <td>

                          <span
                            className={`transactions-payment-type ${
                              item.payment_type ===
                              "Final Payment"
                                ? "final"
                                : "down-payment"
                            }`}
                          >

                            {
                              item.payment_type ||
                              "Down Payment"
                            }

                          </span>

                        </td>


                        <td>
                          {
                            item.description
                          }
                        </td>


                        <td>

                          <span
                            className={`transactions-payment ${
                              item.payment_method ===
                              "QRIS"
                                ? "qris"
                                : "cash"
                            }`}
                          >

                            {
                              item.payment_method
                            }

                          </span>

                        </td>


                        <td>

                          {formatRupiah(
                            item.amount
                          )}

                        </td>


                        <td>

                          {Number(
                            item.mdr_percentage ||
                              0
                          ) > 0
                            ? `${item.mdr_percentage}%`
                            : "-"}

                        </td>


                        <td>

                          {formatRupiah(
                            item.net_amount
                          )}

                        </td>


                        <td>

                          <button
                            type="button"
                            className="transactions-delete"
                            onClick={() =>
                              handleDelete(
                                item
                              )
                            }
                          >
                            Delete
                          </button>

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

        <footer className="transactions-footer">

          <span>
            PLUNO INTERNAL SYSTEM
          </span>

          <span>
            v1.0 · 2026
          </span>

        </footer>

      </main>


      {/* =================================================
          ADD TRANSACTION MODAL
      ================================================= */}

      {showAddModal && (

        <div className="transactions-overlay">

          <div className="transactions-modal">


            <div className="transactions-modal-header">

              <div>

                <span>
                  NEW TRANSACTION
                </span>

                <h2>
                  Add Transaction
                </h2>

                <p>
                  Record customer payment.
                </p>

              </div>


              <button
                type="button"
                className="transactions-close"
                onClick={
                  closeAddModal
                }
              >
                ×
              </button>

            </div>


            <form
              onSubmit={
                handleSubmit
              }
            >

              <div className="transactions-form-grid">


                <div className="transactions-field">

                  <label>
                    TRANSACTION DATE
                  </label>

                  <input
                    type="date"
                    name="transaction_date"
                    value={
                      formData.transaction_date
                    }
                    onChange={
                      handleFormChange
                    }
                    required
                  />

                </div>


                <div className="transactions-field">

                  <label>
                    CUSTOMER
                  </label>

                  <input
                    type="text"
                    name="customer"
                    placeholder="Customer name"
                    value={
                      formData.customer
                    }
                    onChange={
                      handleFormChange
                    }
                    required
                  />

                </div>


                <div className="transactions-field">

                  <label>
                    PAYMENT TYPE
                  </label>

                  <select
                    name="payment_type"
                    value={
                      formData.payment_type
                    }
                    onChange={
                      handleFormChange
                    }
                    required
                  >

                    <option value="Down Payment">
                      Down Payment
                    </option>

                    <option value="Final Payment">
                      Final Payment
                    </option>

                  </select>

                </div>


                <div className="transactions-field">

                  <label>
                    DESCRIPTION
                  </label>

                  <input
                    type="text"
                    name="description"
                    placeholder="Package / transaction description"
                    value={
                      formData.description
                    }
                    onChange={
                      handleFormChange
                    }
                    required
                  />

                </div>


                <div className="transactions-field">

                  <label>
                    AMOUNT
                  </label>

                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Rp 0"
                    value={
                      formData.amount
                        ? Number(
                            formData.amount
                          ).toLocaleString(
                            "id-ID"
                          )
                        : ""
                    }
                    onChange={
                      handleAmountChange
                    }
                    required
                  />

                </div>


                <div className="transactions-field">

                  <label>
                    PAYMENT METHOD
                  </label>

                  <select
                    name="payment_method"
                    value={
                      formData.payment_method
                    }
                    onChange={
                      handleFormChange
                    }
                  >

                    <option value="Cash">
                      Cash
                    </option>

                    <option value="QRIS">
                      QRIS
                    </option>

                  </select>

                </div>


                <div className="transactions-field">

                  <label>
                    INFORMATION
                  </label>

                  <input
                    type="text"
                    name="information"
                    placeholder="Additional information"
                    value={
                      formData.information
                    }
                    onChange={
                      handleFormChange
                    }
                  />

                </div>

              </div>


              <div className="transactions-preview">

                <div>

                  <span>
                    GROSS
                  </span>

                  <strong>
                    {formatRupiah(
                      formData.amount
                    )}
                  </strong>

                </div>


                <div>

                  <span>
                    MDR
                  </span>

                  <strong>

                    {
                      formData.payment_method ===
                      "QRIS"
                        ? `${mdrPercentage}%`
                        : "0%"
                    }

                  </strong>

                </div>


                <div>

                  <span>
                    NET RECEIVED
                  </span>

                  <strong>

                    {formatRupiah(
                      Number(
                        formData.amount ||
                          0
                      ) -
                        Math.round(
                          Number(
                            formData.amount ||
                              0
                          ) *
                            (
                              formData.payment_method ===
                              "QRIS"
                                ? mdrPercentage /
                                  100
                                : 0
                            )
                        )
                    )}

                  </strong>

                </div>

              </div>


              {errorMessage && (

                <div className="transactions-form-error">
                  {
                    errorMessage
                  }
                </div>

              )}


              <div className="transactions-modal-footer">

                <button
                  type="button"
                  className="transactions-cancel"
                  onClick={
                    closeAddModal
                  }
                  disabled={
                    saving
                  }
                >
                  Cancel
                </button>


                <button
                  type="submit"
                  className="transactions-save"
                  disabled={
                    saving
                  }
                >

                  {saving
                    ? "Saving..."
                    : "Save Transaction"}

                </button>

              </div>

            </form>

          </div>

        </div>

      )}


      {/* =================================================
          QRIS MDR SETTINGS MODAL
      ================================================= */}

      {showMdrSettings && (

        <div className="transactions-overlay">

          <div className="transactions-modal transactions-mdr-modal">

            <div className="transactions-modal-header">

              <div>

                <span>
                  PAYMENT PROCESSING
                </span>

                <h2>
                  QRIS MDR
                </h2>

              </div>


              <button
                type="button"
                className="transactions-close"
                onClick={
                  closeMdrSettings
                }
              >
                ×
              </button>

            </div>


            <div className="transactions-mdr-settings-body">

              <div className="transactions-field">

                <label>
                  MDR PERCENTAGE
                </label>


                <div className="transactions-mdr-input">

                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={
                      mdrFormValue
                    }
                    onChange={
                      handleMdrChange
                    }
                    placeholder="0.7"
                    autoFocus
                  />


                  <span>
                    %
                  </span>

                </div>

              </div>

            </div>


            {errorMessage && (

              <div className="transactions-form-error">
                {
                  errorMessage
                }
              </div>

            )}


            <div className="transactions-modal-footer">

              <button
                type="button"
                className="transactions-cancel"
                onClick={
                  closeMdrSettings
                }
              >
                Cancel
              </button>


              <button
                type="button"
                className="transactions-save"
                onClick={
                  saveMdrSettings
                }
              >
                Save
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}


export default Transactions;