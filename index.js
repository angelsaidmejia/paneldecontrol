// Existing code...

function loadCompletedOrders() {
    // Existing code to load completed orders...

    // Add Expense Button
    const addExpenseButton = document.createElement('button');
    addExpenseButton.innerText = 'Add Expense';
    addExpenseButton.onclick = openExpensesModal;
    document.body.appendChild(addExpenseButton);
}

function openExpensesModal() {
    // Create modal structure
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.width = '300px';
    modal.style.height = '200px';
    modal.style.top = '50%';
    modal.style.left = '50%';
    modal.style.transform = 'translate(-50%, -50%)';
    modal.style.backgroundColor = 'white';
    modal.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
    modal.style.padding = '20px';

    const title = document.createElement('h2');
    title.innerText = 'Add Expense';
    modal.appendChild(title);

    // Expense detail input
    const expenseInput = document.createElement('input');
    expenseInput.placeholder = 'Expense details';
    modal.appendChild(expenseInput);

    // Submit Button
    const submitButton = document.createElement('button');
    submitButton.innerText = 'Submit';
    submitButton.onclick = function() {
        handleAddExpense(expenseInput.value);
        document.body.removeChild(modal);
    };
    modal.appendChild(submitButton);

    document.body.appendChild(modal);
}

function handleAddExpense(details) {
    console.log('Adding expense:', details);
    // Logic to handle adding the expense goes here...
}