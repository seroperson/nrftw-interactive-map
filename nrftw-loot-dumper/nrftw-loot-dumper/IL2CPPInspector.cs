using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace nrftw_loot_dumper
{
    using UnityEngine;
    using Il2CppInterop.Runtime;
    using MelonLoader;
    using System;
    using Il2CppInterop.Runtime.Runtime;
    using Il2CppInterop.Runtime.InteropTypes;

    public class IL2CPPInspector
    {
        public static void InspectComponent(Il2CppObjectBase component, bool inspectFields = true, bool inspectMethods = false)
        {
            var objectPtr = IL2CPP.Il2CppObjectBaseToPtrNotNull(component);
            IntPtr classPtr = IL2CPP.il2cpp_object_get_class(objectPtr);

            string className = IL2CPP.il2cpp_class_get_name_(classPtr);
            string nameSpace = IL2CPP.il2cpp_class_get_namespace_(classPtr);

            MelonLogger.Msg($"\n--- Component: {nameSpace}.{className} ---");

            if (inspectFields)
            {
                InspectFields(component, classPtr);
            }

            if (inspectMethods)
            {
                InspectMethods(classPtr);
            }
        }

        private static void InspectFields(Il2CppObjectBase component, IntPtr classPtr)
        {
            MelonLogger.Msg("Fields:");

            IntPtr iter = IntPtr.Zero;
            IntPtr fieldPtr;

            while ((fieldPtr = IL2CPP.il2cpp_class_get_fields(classPtr, ref iter)) != IntPtr.Zero)
            {
                string fieldName = IL2CPP.il2cpp_field_get_name_(fieldPtr);
                IntPtr fieldTypePtr = IL2CPP.il2cpp_field_get_type(fieldPtr);
                string fieldTypeName = IL2CPP.il2cpp_type_get_name_(fieldTypePtr);

                // Get field offset and flags
                uint offset = IL2CPP.il2cpp_field_get_offset(fieldPtr);

                MelonLogger.Msg($"  [{offset}] {fieldTypeName} {fieldName}");
            }
        }

        private static void InspectMethods(IntPtr classPtr)
        {
            MelonLogger.Msg("Methods:");

            IntPtr iter = IntPtr.Zero;
            IntPtr methodPtr;

            while ((methodPtr = IL2CPP.il2cpp_class_get_methods(classPtr, ref iter)) != IntPtr.Zero)
            {
                string methodName = IL2CPP.il2cpp_method_get_name_(methodPtr);
                uint paramCount = IL2CPP.il2cpp_method_get_param_count(methodPtr);

                // Get return type
                IntPtr returnTypePtr = IL2CPP.il2cpp_method_get_return_type(methodPtr);
                string returnTypeName = IL2CPP.il2cpp_type_get_name_(returnTypePtr);

                MelonLogger.Msg($"  {returnTypeName} {methodName}({paramCount} params)");
            }
        }
    }
}
