import { LightningElement, api, wire, track } from 'lwc';
import { getObjectInfo, getPicklistValues } from 'lightning/uiObjectInfoApi';
import { FlowAttributeChangeEvent } from 'lightning/flowSupport';




export default class GenericRecordTypePicklist extends LightningElement {


    @api objectApiName;
    @api fieldApiName;
    @api labelOverride;
    @api helpText;
    @api multiSelect = false;
    @api required = false;
    @api useRecordType = false;
    @api recordTypeIdentifier;
    @api disabled = false;
    @api readOnlyMode = false;
    @api currentRecordTypeId;




   
    _defaultValue;
    @api
    get defaultValue() { return this._defaultValue; }
    set defaultValue(v) {
        this._defaultValue = v;
        this.tryApplyDefault();
    }




 
    _value = null;




    @api
    get value() {
        return this._value;
    }
    set value(v) {
        this._value = this.normalizeIncomingValue(v);
    }






    @track options = [];
    objectInfo;
    recordTypeId;
    defaultApplied = false;
    errorMessage = '';






    _currentObject;
    _currentField;
    actualRecordTypeOptions = [];






    get isDisplayOnly() {
        return this.readOnlyMode === true;
    }




    get formattedValue() {
        if (!this._value) return 'N/A';
        const vals = String(this._value).split(';');
        const labels = vals.map(v => {
            const opt = this.options.find(o => o.value === v);
            return opt ? opt.label : v;
        }).filter(l => l !== '--None--');
        return labels.join(', ');
    }






    get resolvedLabel() {
        if (this.labelOverride) return this.labelOverride;
        return this.objectInfo?.fields?.[this.fieldApiName]?.label || this.fieldApiName;
    }






    normalizeIncomingValue(v) {
        if (!v) return null;
        if (this.multiSelect) {
            if (Array.isArray(v)) return v.join(';');
            return String(v);
        }
        if (Array.isArray(v)) return v[0];
        return String(v);
    }




    toArrayValue() {
        if (!this._value) return [];
        return String(this._value).split(';').filter(Boolean);
    }




    get singleValue() {
        return this.multiSelect ? null : (this._value || '');
    }




    get multiValueArray() {
        return this.multiSelect ? this.toArrayValue() : [];
    }






    @wire(getObjectInfo, { objectApiName: '$objectApiName' })
    objectInfoWire({ data, error }) {
        if (data) {


            if (this._currentObject !== this.objectApiName) {
                this.options = [];
                this._currentObject = this.objectApiName;
            }
            this.objectInfo = data;
            this.computeRecordType();
        } else if (error) {
            this.errorMessage = 'Object metadata error';
        }
    }




    computeRecordType() {


        if (!this.useRecordType || !this.recordTypeIdentifier) {
            this.recordTypeId = '012000000000000AAA';
            return;
        }
        const rtis = this.objectInfo.recordTypeInfos;
        const match = Object.values(rtis).find(r =>
            r.recordTypeId === this.recordTypeIdentifier ||
            r.name === this.recordTypeIdentifier ||
            r.developerName === this.recordTypeIdentifier ||
            r.label === this.recordTypeIdentifier
        );
        this.recordTypeId = match ? match.recordTypeId : '012000000000000AAA';
    }




    get qualifiedField() {
        if (!this.objectApiName || !this.fieldApiName) return null;
        return `${this.objectApiName}.${this.fieldApiName}`;
    }




    @wire(getPicklistValues, {
        recordTypeId: '$recordTypeId',
        fieldApiName: '$qualifiedField'
    })
    picklistWire({ data, error }) {


        if (this._currentField !== this.qualifiedField) {
            this.options = [];
            this._currentField = this.qualifiedField;
        }
        if (data) {
            let rawOptions = data.values.map(v => ({ label: v.label, value: v.value }));
            if (!this.multiSelect) {
                this.options = [{ label: '--None--', value: '' }, ...rawOptions];
            } else {
                this.options = rawOptions;
            }
            this.tryApplyDefault();
            this.errorMessage = '';
        } else if (error) {
            this.options = [];
            this.errorMessage = 'Picklist load error';
        }
    }






    get validationRecordTypeId() {
        return this.currentRecordTypeId || '012000000000000AAA';
    }




    @wire(getPicklistValues, {
        recordTypeId: '$validationRecordTypeId',
        fieldApiName: '$qualifiedField'
    })
    validationWire({ data }) {
        if (data) {
            this.actualRecordTypeOptions = data.values.map(v => v.value);
        }
    }




    handleSingleChange(event) {
        const val = event.detail.value;
        this._value = val === '' ? null : val;
        this.fireFlowUpdate();
    }




    handleMultiChange(event) {
        const arr = event.detail.value || [];
        this._value = arr.length ? arr.join(';') : null;
        this.fireFlowUpdate();
    }




    fireFlowUpdate() {
        this.dispatchEvent(new FlowAttributeChangeEvent('value', this._value));
    }




    tryApplyDefault() {
        if (this.defaultApplied || !this.options.length || this._value || !this._defaultValue) return;
        const normalized = this.normalizeIncomingValue(this._defaultValue);
        if (this.multiSelect) {
            const valid = normalized.split(';').filter(v => this.options.some(o => o.value === v));
            if (valid.length) this._value = valid.join(';');
        } else {
            if (this.options.some(o => o.value === normalized)) this._value = normalized;
        }
        this.defaultApplied = true;
    }




    @api
    validate() {
        // Required check
        if (this.required && !this._value) {
            return { isValid: false, errorMessage: 'Please select a value' };
        }




        // Validation against the record's specific record type
        if (this._value && this.actualRecordTypeOptions.length > 0) {
            const selectedValues = String(this._value).split(';');
            const invalidValues = selectedValues.filter(val => !this.actualRecordTypeOptions.includes(val));
           
            if (invalidValues.length > 0) {
                return {
                    isValid: false,
                    errorMessage: `This record's type does not support the selected value: ${invalidValues.join(', ')}.`
                };
            }
        }
        return { isValid: true };
    }
}
