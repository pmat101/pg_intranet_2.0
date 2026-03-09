# SETUP

1.  Create spreadsheet with tabs and headers

2.  Create AppScript project > enable `appscript.json` > set script property with sheet ID

3.  Add `getDB()` helper in **Code.gs** to get sheet as object

4.  Add `doGet()` routing in **webRoutes.gs** so that URL parameters load the right HTML page

5.  Create a simple landing page **index.html**

6.  Create shared StyleSheet **sharedStyles.html** and follow the HTML template (below) accordingly

7.  Add server endpoint `getDropdownData()` in **config.gs**.

8.  Create **bd01a.html** with styles using **sharedStyles.html** and dropdowns using **config.gs**. Add client snippets in form files to populate `select` fields

9.  Collect all form data in payLoad variable and send to server

10. Add `getNextProjectSerial()` and `genProposalIDnPCODE ()` in **Code.gs** to get serial number, generatae Proposal ID and PCODE

---

```
    <!-- For main form fields -->

    <div class="form-wrapper">
    <div class="form-title">BD01-A</div>
    <div class="form-subtitle">To be filled by BD Team before offer is sent</div>

    <div class="form-section">
        <div class="form-group">
            <label class="form-label"> Date <span class="required"> * </span> </label>
            <input type="date" id="visit-date" />
            <div class="helper-text">dd-MMM-yyyy</div>
        </div>
        <div class="form-row">
            <div class="form-col">
                <div class="form-group">
                    <label class="form-label">First Name</label>
                    <input type="text" />
                </div>
            </div>
            <div class="form-col">
                <div class="form-group">
                    <label class="form-label">Last Name</label>
                    <input type="text" />
                </div>
            </div>
        </div>
    </div>
    <button class="btn-primary">Submit</button>
    </div>


    <!-- For sub-form fields -->

    <div class="form-section">
        <div class="section-heading">Hotel Booking</div>
        <div class="subform-card">
            <div class="form-row">
            <div class="form-col">
                <div class="form-group">
                <label class="form-label">Guest Name</label>
                <input type="text">
                </div>
            </div>
            <div class="form-col">
                <div class="form-group">
                <label class="form-label">Check-in Date</label>
                <input type="date">
                </div>
            </div>
            </div>
        </div>
    </div>

```
