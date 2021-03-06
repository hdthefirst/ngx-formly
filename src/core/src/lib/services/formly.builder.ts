import { Injectable, ComponentFactoryResolver, Injector, Optional } from '@angular/core';
import { FormGroup, FormArray, FormGroupDirective } from '@angular/forms';
import { FormlyConfig } from './formly.config';
import { FormlyFieldConfig, FormlyFormOptions, FormlyFieldConfigCache } from '../models';
import { defineHiddenProp, reduceFormUpdateValidityCalls, observe } from '../utils';

@Injectable({ providedIn: 'root' })
export class FormlyFormBuilder {
  constructor(
    private config: FormlyConfig,
    private resolver: ComponentFactoryResolver,
    private injector: Injector,
    @Optional() private parentForm: FormGroupDirective,
  ) {}

  buildForm(form: FormGroup | FormArray, fieldGroup: FormlyFieldConfig[] = [], model: any, options: FormlyFormOptions) {
    this.buildField({ fieldGroup, model, form, options });
  }

  buildField(field: FormlyFieldConfig) {
    if (!this.config.extensions.core) {
      throw new Error('NgxFormly: missing `forRoot()` call. use `forRoot()` when registering the `FormlyModule`.');
    }

    if (!field.parent) {
      this._setOptions(field);
      reduceFormUpdateValidityCalls(field.form, () => this._buildField(field));
      const options = (field as FormlyFieldConfigCache).options;
      options._checkField && options._checkField(field, true);
    } else {
      this._buildField(field);
    }
  }

  private _buildField(field: FormlyFieldConfigCache) {
    if (!field) {
      return;
    }

    this.getExtensions().forEach((extension) => extension.prePopulate && extension.prePopulate(field));
    this.getExtensions().forEach((extension) => extension.onPopulate && extension.onPopulate(field));

    if (field.fieldGroup) {
      field.fieldGroup.forEach((f) => this._buildField(f));
    }

    this.getExtensions().forEach((extension) => extension.postPopulate && extension.postPopulate(field));
  }

  private getExtensions() {
    return Object.keys(this.config.extensions).map((name) => this.config.extensions[name]);
  }

  private _setOptions(field: FormlyFieldConfigCache) {
    field.form = field.form || new FormGroup({});
    field.model = field.model || {};
    field.options = field.options || {};
    const options = field.options;

    if (!options._resolver) {
      defineHiddenProp(options, '_resolver', this.resolver);
    }

    if (!options._injector) {
      defineHiddenProp(options, '_injector', this.injector);
    }

    if (!options._buildField) {
      options._buildForm = () => {
        console.warn(`Formly: 'options._buildForm' is deprecated since v6.0, use 'options._buildField' instead.`);
        this.buildField(field);
      };
      options._buildField = (f: FormlyFieldConfig) => this.buildField(f);
    }

    if (!options.parentForm && this.parentForm) {
      defineHiddenProp(options, 'parentForm', this.parentForm);
      observe(options, ['parentForm', 'submitted'], ({ firstChange }) => {
        if (!firstChange) {
          options._checkField(field);
          options._markForCheck(field);
        }
      });
    }
  }
}
